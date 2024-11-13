#include <stdio.h>
#include <string.h>
#include <crack.h>

int main(int ARGC, char* ARGV[]) {
  const char *path = GetDefaultCracklibDict();
  char passwd[256];
  char user[256];
  char gecos[256];
  char *retval;

  if (ARGC < 4) {
    printf("Usage: checkpass <pass> <login> <fullname>\n");
    return 0;
  }

  strncpy(passwd, ARGV[1], sizeof passwd);
  strncpy(user, ARGV[2], sizeof user);
  strncpy(gecos, ARGV[3], sizeof gecos);

  retval = (char *) FascistCheckUser(passwd, path, user, gecos);
  if (retval != NULL) {
    printf("Invalid Password: %s\n",retval);
    return 1;
  }
  printf("ok\n");
  return 0;
}
