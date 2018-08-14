# ports collection makefile for: emulab-extras
# Date created:         15 June 2015
# Whom:                 testbed-ops@flux.utah.edu

.include "../emulab-boss/Makefile.emulab"

PORTNAME=	emulab-extras
PORTVERSION=	${EMULAB_PORTVERSION}
CATEGORIES=	misc
MASTER_SITES=	#none
DISTFILES=	#none
EXTRACT_ONLY=	#none

MAINTAINER=	testbed-ops@flux.utah.edu
COMMENT=	"Extra convenience packages for Emulab"

NO_BUILD=	yes

#
# This prevents any ports from trying to configure interactively.
#
BATCH=		yes
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

#
# XXX hackary to get around bugs in Makefiles:
#
# Both pango (required by graphviz) and gtk-update-icon-cache (required by
# emacs) perform a Makefile (pre-configure target) existence check using
# ".if exists" for the cairo port. However, since that check is done at
# Makefile parse time, the things they are checking for might not yet be
# installed. Instead those items get installed as a result of the dependencies
# in the Makefile. The Makefiles should really be changed to make run-time
# check (i.e., a shell "test" command) for the existence of packages that
# they might install.
#
RUN_DEPENDS=	\
	${LOCALBASE}/libdata/pkgconfig/cairo-gobject.pc:${PORTSDIR}/graphics/cairo

# XXX do vim-lite to avoid dragging in gtk
RUN_DEPENDS+=	\
	bash:${PORTSDIR}/shells/bash \
	${LOCALBASE}/sbin/e2fsck:${PORTSDIR}/sysutils/e2fsprogs \
	emacs:${PORTSDIR}/editors/emacs \
	git:${PORTSDIR}/devel/git \
	jove:${PORTSDIR}/editors/jove \
	lsof:${PORTSDIR}/sysutils/lsof \
	rsync:${PORTSDIR}/net/rsync \
	sudo:${PORTSDIR}/security/sudo \
	ttcp:${PORTSDIR}/benchmarks/ttcp \
	xauth:${PORTSDIR}/x11/xauth \
	xterm:${PORTSDIR}/x11/xterm \
	zsh:${PORTSDIR}/shells/zsh

.if (${PORTVERSION} == "7.1" || ${PORTVERSION} == "7.2")
RUN_DEPENDS+=	\
	vim:${PORTSDIR}/editors/vim-console
.else
RUN_DEPENDS+=	\
	vim:${PORTSDIR}/editors/vim-lite
.endif

RUN_DEPENDS+=	\
	${PYTHON_PKGNAMEPREFIX}subversion>0:${PORTSDIR}/devel/py-subversion

USES=		python:2.7

do-install:	# empty

.include <bsd.port.mk>
