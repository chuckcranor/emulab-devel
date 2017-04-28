# Created by: Gary Wong <gtw@flux.utah.edu>

PORTNAME=	abac
PORTVERSION=	0.1.9
CATEGORIES=	misc
MASTER_SITES=	http://mirror.deterlab.net/share/images/abac/ \
		http://www.emulab.net/downloads/

MAINTAINER=	testbed-ops@flux.utah.edu
COMMENT=	"Attribute-Based Access Control library, as adopted by GENI"

GNU_CONFIGURE=	yes
USE_AUTOTOOLS=	autoconf
USES=		gettext gmake libtool perl5 python
CPPFLAGS+=	-I${LOCALBASE}/include
LDFLAGS+=	-L${LOCALBASE}/lib

BUILD_DEPENDS=	swig2.0:${PORTSDIR}/devel/swig20 \
		xmlsec1:${PORTSDIR}/security/xmlsec1

.include <bsd.port.mk>
