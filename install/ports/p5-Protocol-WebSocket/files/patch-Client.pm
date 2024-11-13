--- lib/Protocol/WebSocket/Client.pm.orig	2017-12-12 12:16:34.000000000 -0700
+++ lib/Protocol/WebSocket/Client.pm	2024-10-10 15:47:55.535271000 -0600
@@ -24,6 +24,7 @@
 
     $self->{on_connect} = $params{on_connect};
     $self->{on_write} = $params{on_write};
+    $self->{on_read}  = $params{on_read};
     $self->{on_frame} = $params{on_frame};
     $self->{on_eof}   = $params{on_eof};
     $self->{on_error} = $params{on_error};
