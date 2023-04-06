# Created by: David Thiel <lx@redundancy.redundancy.org>
#
# XXX hacked for Emulab to use a post-2.2 checkout of the git repository
# that fixes some segmentation fault issues we have.
#

PORTNAME=	emulab-medusa
PORTVERSION=	2.2post
PORTREVISION=	1
CATEGORIES=	misc
MASTER_SITES=	http://www.emulab.net/downloads/

MAINTAINER=	testbed-ops@flux.utah.edu
COMMENT=	Speedy, massively parallel, modular, login brute-forcer

LICENSE=	GPLv2+
LICENSE_FILE=	${WRKSRC}/COPYING

CONFLICTS=	medusa

LIB_DEPENDS=	libssh2.so:security/libssh2 \
		libgcrypt.so:security/libgcrypt libgnutls.so:security/gnutls

USES=	ssl

GNU_CONFIGURE=	yes
CONFIGURE_ARGS=	--enable-module-ncp=no --enable-module-afp=no
CFLAGS+=	-fcommon

OPTIONS_DEFINE=	DOCS
OPTIONS_SUB=	yes

SUBVERSION_LIB_DEPENDS=	libsvn_client-1.so:devel/subversion
SUBVERSION_CFLAGS=	-I${LOCALBASE}/include/subversion-1 -I${LOCALBASE}/include/apr-1
SUBVERSION_CONFIGURE_OFF=	--enable-module-svn=no

PGSQL_USES=		pgsql
PGSQL_CONFIGURE_ON=	--enable-module-postgres
PGSQL_CONFIGURE_OFF=	--enable-module-postgres=no

post-install:
	@${MKDIR} ${STAGEDIR}${PREFIX}/share/zsh/site-functions
	${INSTALL_DATA} ${WRKSRC}/misc/zsh/_medusa \
		${STAGEDIR}${PREFIX}/share/zsh/site-functions/_medusa

post-install-DOCS-on:
	@${MKDIR} ${STAGEDIR}${DOCSDIR}
	${INSTALL_DATA} ${WRKSRC}/doc/*.html ${STAGEDIR}${DOCSDIR}

.include <bsd.port.mk>
