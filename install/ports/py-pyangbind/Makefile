# Created by: 
# $FreeBSD$

PORTNAME=	pyangbind
PORTVERSION=	0.8.7
CATEGORIES=	devel python misc
MASTER_SITES=	PYPI
PKGNAMEPREFIX=	${PYTHON_PKGNAMEPREFIX}

MAINTAINER=	testbed-ops@emulab.net
COMMENT=	Pyangbind is a plugin for pyang which converts yang data models into a python class hierarchy, such that python can be used to manipulate data that conforms with a yang model

# LICENSE=	Apache License, Version 2.0 # Ensure this is valid! See ${PORTSDIR}/Mk/bsd.licenses.db.mk.

RUN_DEPENDS=	${PYTHON_PKGNAMEPREFIX}setuptools>0:devel/py-setuptools@${PY_FLAVOR} \
		${PYTHON_PKGNAMEPREFIX}pyang>0:net-mgmt/py-pyang@${PY_FLAVOR} \
		${PYTHON_PKGNAMEPREFIX}lxml>0:devel/py-lxml@${PY_FLAVOR} \
		${PYTHON_PKGNAMEPREFIX}regex>0:textproc/py-regex@${PY_FLAVOR}

USES=		python:3.8+ # 3.8, 3.9, 3.10, 3.11, 3.12, 3.13
USE_PYTHON=	autoplist pep517

.include <bsd.port.mk>
