#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>
#include <pwd.h>

int main() {
    setuid(0);
    clearenv();
    system("expect /etc/telegraf/powduino.exp | grep '^[0-9]'");
    return 0;
}
