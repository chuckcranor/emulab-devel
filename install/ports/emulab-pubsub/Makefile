# ports collection makefile for: emulab-pubsub

PORTNAME=	pubsub
PORTVERSION=	0.99
PORTREVISION=	11
CATEGORIES=	misc
MASTER_SITES=	http://www.emulab.net/distributions/
DISTFILES=      ${PORTNAME}-${PORTVERSION}_${PORTREVISION}.tar.gz
WRKSRC=         ${WRKDIR}/${PORTNAME}-${PORTVERSION}_${PORTREVISION}

MAINTAINER=	testbed-ops@flux.utah.edu
COMMENT=	"Simple publish subscribe system for Emulab"

USE_AUTOTOOLS=	autoconf
USES=		gmake libtool:build,keepla
INSTALLS_SHLIB=	yes

CONFLICTS=	pubsub-elvincompat-[0-9]*
MAKE_FLAGS=	ELVIN_COMPAT= ELVIN_NOELVIN=1

.include <bsd.port.mk>
