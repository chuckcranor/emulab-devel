# ports collection makefile for: emulab-extras

PORTNAME=	emulab-extras
PORTVERSION=	1.0
CATEGORIES=	misc
MASTER_SITES=	#none
DISTFILES=      #none
EXTRACT_ONLY=	#none
COMMENT=	"Extra convenience packages for Emulab"

MAINTAINER=	testbed-ops@flux.utah.edu

NO_BUILD=	yes

#
# This prevents any ports from trying to run interactively - some, like the
# net-snmp port, ask silly questions without this option.
#
.MAKEFLAGS+=	-DBATCH

#
# Emacs configuration options. Controls the worst of the excesses.
# I am reasonably confident that these options will not affect the
# other ports listed.
#
.MAKEFLAGS+=	WITHOUT_DBUS=yes
.MAKEFLAGS+=	WITHOUT_GCONF=yes
.MAKEFLAGS+=	WITHOUT_GIF=yes
.MAKEFLAGS+=	WITHOUT_GSETTINGS=yes
.MAKEFLAGS+=	WITHOUT_GTK2=yes
.MAKEFLAGS+=	WITH_JPEG=yes
.MAKEFLAGS+=	WITHOUT_M17N=yes
.MAKEFLAGS+=	WITHOUT_MOTIF=yes
.MAKEFLAGS+=	WITHOUT_OTF=yes
.MAKEFLAGS+=	WITHOUT_PNG=yes
.MAKEFLAGS+=	WITHOUT_SOUND=yes
.MAKEFLAGS+=	WITH_SOURCES=yes
.MAKEFLAGS+=	WITHOUT_SVG=yes
.MAKEFLAGS+=	WITHOUT_TIFF=yes
.MAKEFLAGS+=	WITH_X11=yes
.MAKEFLAGS+=	WITH_XAW=yes
.MAKEFLAGS+=	WITHOUT_XAW3D=yes
.MAKEFLAGS+=	WITH_SYNC_INPUT=yes
.MAKEFLAGS+=	WITHOUT_SCROLLBARS=yes
.MAKEFLAGS+=	WITHOUT_XFT=yes
.MAKEFLAGS+=	WITHOUT_XIM=yes
.MAKEFLAGS+=	WITHOUT_XPM=yes

# XXX avoid dragging in 4.1 in portupgrade/ruby/ruby-bdb
.MAKEFLAGS+=	WITH_BDB_VER=42

# XXX do vim-lite to avoid dragging in gtk
RUN_DEPENDS=	\
        ${LOCALBASE}/bin/bash:${PORTSDIR}/shells/bash \
        ${LOCALBASE}/bin/jove:${PORTSDIR}/editors/jove \
        ${LOCALBASE}/bin/emacs:${PORTSDIR}/editors/emacs \
        ${LOCALBASE}/bin/vim:${PORTSDIR}/editors/vim-lite \
        ${LOCALBASE}/sbin/lsof:${PORTSDIR}/sysutils/lsof \
        ${LOCALBASE}/bin/netcat:${PORTSDIR}/net/netcat \
        ${LOCALBASE}/bin/ttcp:${PORTSDIR}/benchmarks/ttcp \
        ${LOCALBASE}/sbin/e2fsck:${PORTSDIR}/sysutils/e2fsprogs \
        ${LOCALBASE}/sbin/portupgrade:${PORTSDIR}/ports-mgmt/portupgrade \
        ${PYTHON_SITELIBDIR}/svn/client.py:${PORTSDIR}/devel/py-subversion \
        ${LOCALBASE}/bin/xterm:${PORTSDIR}/x11/xterm \
        ${LOCALBASE}/sbin/portaudit:${PORTSDIR}/ports-mgmt/portaudit

USE_PYTHON=	yes

do-install:	# empty

.include <bsd.port.mk>
