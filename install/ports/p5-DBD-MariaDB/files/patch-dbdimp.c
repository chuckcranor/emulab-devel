--- dbdimp.c.orig
+++ dbdimp.c
@@ -1399,6 +1399,10 @@ static int mariadb_dr_socket_cloexec(my_socket sock_os)
   DWORD flags;
   int error;
 
+  /* Ignore not the Winsock socket base connections */
+  if (sock_os == 0)
+    return 0;
+
   if (!GetHandleInformation(handle, &flags))
   {
     error = GetLastError();
@@ -2392,17 +2396,19 @@ static bool mariadb_dr_connect(
       /*
         Client library returns socket in my_socket type, which is C file
         descriptor on Linux or Windows native socket type on Windows.
+        On Windows it can be zero in case connection type is not socket.
         Perl requires sockets to always be in C file descriptor type,
         so on Windows associate it with C file descriptor via Perl's
         win32_open_osfhandle() function.
       */
 #ifdef _WIN32
-      imp_dbh->sock_fd = win32_open_osfhandle(sock_os, O_RDWR|O_BINARY);
+      imp_dbh->sock_fd = sock_os != 0 ? win32_open_osfhandle(sock_os, O_RDWR|O_BINARY) : -1;
 #else
       imp_dbh->sock_fd = sock_os;
 #endif
 
 #ifdef _WIN32
+      if (imp_dbh->sock_fd >= 0)
       {
         /*
          * Winsock SO_UPDATE_CONNECT_CONTEXT option needs to be set on the socket,
@@ -3129,7 +3135,7 @@ static void mariadb_dr_close_mysql(pTHX_ imp_drh_t *imp_drh, MYSQL *pmysql)
   }
 }
 
-static void mariadb_db_close_mysql(pTHX_ imp_drh_t *imp_drh, imp_dbh_t *imp_dbh)
+static void mariadb_db_close_mysql(pTHX_ imp_drh_t *imp_drh, imp_dbh_t *imp_dbh, bool follow_inactive_destroy)
 {
   AV *av;
   I32 i;
@@ -3138,6 +3144,11 @@ static void mariadb_db_close_mysql(pTHX_ imp_drh_t *imp_drh, imp_dbh_t *imp_dbh)
   SV *sv;
   SV *sth;
   imp_sth_t *imp_sth;
+#ifdef _WIN32
+  SOCKET sock_os;
+#else
+  int empty_sock_fd;
+#endif
 
   if (DBIc_TRACE_LEVEL(imp_dbh) >= 2)
     PerlIO_printf(DBIc_LOGPIO(imp_dbh), "\tmariadb_db_close_mysql: imp_dbh=%p pmysql=%p\n", imp_dbh, imp_dbh->pmysql);
@@ -3149,6 +3160,60 @@ static void mariadb_db_close_mysql(pTHX_ imp_drh_t *imp_drh, imp_dbh_t *imp_dbh)
 
   if (imp_dbh->pmysql)
   {
+    if (follow_inactive_destroy && DBIc_IADESTROY(imp_dbh))
+    {
+      if (imp_dbh->sock_fd < 0)
+      {
+        warn("DBD::MariaDB InactiveDestroy: failed for non-socket connection");
+      }
+      else
+      {
+#ifdef _WIN32
+        /*
+          InactiveDestroy implementation for Windows platforms:
+          Direcrly close the native Windows socket. Probably client library
+          will throw some error but this is the the only option what can we do.
+          MariaDB and MySQL client libraries do not allow us to change or
+          replace communication socket with some other because it is stored
+          in private part of MYSQL* structure. And Windows does have any
+          Winsock function which duplicates and replaces existing and opened
+          socket by a new one, like dup2() (which is used below).
+        */
+        sock_os = win32_get_osfhandle(imp_dbh->sock_fd);
+        closesocket(sock_os);
+#else
+        /*
+          InactiveDestroy implementation for non-Windows platforms:
+          Disassociate underlaying sock_fd from the connection with database
+          server. Do it by creating a new empty temporary disconnected socket
+          and associate it via dup2() with the sock_fd file descriptor number
+          which is used by the MariaDB or MySQL client library for connection
+          to the database server. Client library can still call on it any
+          socket related function without nothing unexpected (it just detects
+          that connection was lost) and without ability to change any server
+          state, like reading pending data, executing commands or closing
+          server-side prepared statements. In case socket() or dup2() fails
+          then close the underlaying sock_fd to ensure that MariaDB or MySQL
+          client library does not contact server.
+        */
+        empty_sock_fd = socket(AF_UNIX, SOCK_STREAM, 0);
+        if (empty_sock_fd < 0)
+        {
+          warn("DBD::MariaDB InactiveDestroy: failed to create a new temporary socket: %s", strerror(errno));
+          close(imp_dbh->sock_fd);
+        }
+        else
+        {
+          if (dup2(empty_sock_fd, imp_dbh->sock_fd) < 0)
+          {
+            warn("DBD::MariaDB InactiveDestroy: failed to setup temporary socket: %s", strerror(errno));
+            close(imp_dbh->sock_fd);
+          }
+          close(empty_sock_fd);
+        }
+#endif
+      }
+    }
     mariadb_dr_close_mysql(aTHX_ imp_drh, imp_dbh->pmysql);
     imp_dbh->pmysql = NULL;
 #ifdef _WIN32
@@ -3226,7 +3291,8 @@ int mariadb_db_disconnect(SV* dbh, imp_dbh_t* imp_dbh)
 
   /* We assume that disconnect will always work       */
   /* since most errors imply already disconnected.    */
-  mariadb_db_close_mysql(aTHX_ imp_drh, imp_dbh);
+  /* Explicit call to $dbh->disconnect() is never affected InactiveDestroy */
+  mariadb_db_close_mysql(aTHX_ imp_drh, imp_dbh, FALSE);
 
   /* We don't free imp_dbh since a reference still exists    */
   /* The DESTROY method is the only one to 'free' memory.    */
@@ -3250,6 +3316,7 @@ int mariadb_db_disconnect(SV* dbh, imp_dbh_t* imp_dbh)
 int mariadb_dr_discon_all (SV *drh, imp_drh_t *imp_drh) {
   dTHX;
   int ret;
+  bool follow_inactive_destroy;
   struct mariadb_list_entry *entry;
   PERL_UNUSED_ARG(drh);
 
@@ -3259,8 +3326,18 @@ int mariadb_dr_discon_all (SV *drh, imp_drh_t *imp_drh) {
     mariadb_list_remove(imp_drh->taken_pmysqls, entry);
   }
 
+  /*
+    Any explicit call to $dbh->disconnect() or $drh->disconnect_all() should
+    do the real disconnect and not to be affected by the InactiveDestroy.
+    DBI implicitly and automatically calls $drh->disconnect_all() in its own
+    END block, which should follow the InactiveDestroy dbh settings.
+    DBI's END block sets $DBI::PERL_ENDING to 1 to allow drivers detecting
+    between implicit and explicit $drh->disconnect_all() calls.
+  */
+  follow_inactive_destroy = SvTRUE(get_sv("DBI::PERL_ENDING", 0));
+
   while (imp_drh->active_imp_dbhs)
-    mariadb_db_close_mysql(aTHX_ imp_drh, (imp_dbh_t *)imp_drh->active_imp_dbhs->data);
+    mariadb_db_close_mysql(aTHX_ imp_drh, (imp_dbh_t *)imp_drh->active_imp_dbhs->data, follow_inactive_destroy);
 
   ret = 1;
 
@@ -3324,18 +3401,14 @@ int mariadb_dr_discon_all (SV *drh, imp_drh_t *imp_drh) {
  *
  **************************************************************************/
 
-void mariadb_db_destroy(SV* dbh, imp_dbh_t* imp_dbh) {
+void mariadb_db_destroy(SV* dbh, imp_dbh_t* imp_dbh)
+{
+  dTHX;
+  D_imp_drh_from_dbh;
+  PERL_UNUSED_ARG(dbh);
 
-    /*
-     *  Being on the safe side never hurts ...
-     */
-  if (DBIc_ACTIVE(imp_dbh))
-  {
-      if (!DBIc_has(imp_dbh, DBIcf_AutoCommit) && imp_dbh->pmysql)
-        if (mysql_rollback(imp_dbh->pmysql))
-          mariadb_dr_do_error(dbh, mysql_errno(imp_dbh->pmysql), mysql_error(imp_dbh->pmysql), mysql_sqlstate(imp_dbh->pmysql));
-    mariadb_db_disconnect(dbh, imp_dbh);
-  }
+  /* Follow InactiveDestroy settings */
+  mariadb_db_close_mysql(aTHX_ imp_drh, imp_dbh, TRUE);
 
   /* Tell DBI, that dbh->destroy must no longer be called */
   DBIc_off(imp_dbh, DBIcf_IMPSET);
@@ -5613,13 +5686,27 @@ void mariadb_st_destroy(SV *sth, imp_sth_t *imp_sth) {
   int num_params;
   int num_fields;
 
-  if (!PL_dirty)
+  if (!PL_dirty && !DBIc_IADESTROY(imp_sth))
   {
     /* During global destruction, DBI objects are destroyed in random order
      * and therefore imp_dbh may be already freed. So do not access it. */
+    /* Also prevent sending any network packets when doing InactiveDestroy. */
     mariadb_st_finish(sth, imp_sth);
     mariadb_st_free_result_sets(sth, imp_sth, TRUE);
   }
+  else
+  {
+    /* Safer variant of releasing some client side buffers and allocated
+     * memory without touching imp_dbh structure or network socket. */
+    if (imp_sth->stmt)
+      mysql_stmt_free_result(imp_sth->stmt);
+
+    if (imp_sth->result)
+    {
+      mysql_free_result(imp_sth->result);
+      imp_sth->result = NULL;
+    }
+  }
 
   DBIc_ACTIVE_off(imp_sth);
 
@@ -5655,6 +5742,17 @@ void mariadb_st_destroy(SV *sth, imp_sth_t *imp_sth) {
 
   if (imp_sth->stmt)
   {
+    /*
+      When doing InactiveDestroy, change client's statement state of server-side
+      prepared statement to pre-prepare state which prevents sending any network
+      packet or deallocating server-side prepared statement on the server itself.
+      It is number less or equal to MYSQL_STMT_INITTED / MYSQL_STMT_INIT_DONE.
+      Some client versions use the number 0, others use the number 1. To ensure
+      that it is "less or equal" for any client, set it to number 0.
+    */
+    if (DBIc_IADESTROY(imp_sth) && imp_sth->stmt)
+      imp_sth->stmt->state = 0;
+
     mysql_stmt_close(imp_sth->stmt);
     imp_sth->stmt= NULL;
   }
