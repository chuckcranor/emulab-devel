from typing import Optional, List

from sqlalchemy import CHAR, Column, DECIMAL, Date, DateTime, Double, Enum, Float, Index, String, TIMESTAMP, Table, Text, Time, text
from sqlalchemy.dialects.mysql import BIGINT, INTEGER, MEDIUMBLOB, MEDIUMINT, MEDIUMTEXT, SET, SMALLINT, TINYINT, TINYTEXT
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedAsDataclass, mapped_column
from sqlalchemy import ForeignKey, and_
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON
import datetime
import decimal

class Base(MappedAsDataclass, DeclarativeBase):
    pass


class AddressRanges(Base):
    __tablename__ = 'address_ranges'

    baseaddr: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    prefix: Mapped[int] = mapped_column(TINYINT(4), primary_key=True, server_default=text('0'))
    type: Mapped[str] = mapped_column(String(30), server_default=text("''"))
    role: Mapped[str] = mapped_column(Enum('public', 'internal'), server_default=text("'internal'"))


class AptAggregateEvents(Base):
    __tablename__ = 'apt_aggregate_events'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    event: Mapped[str] = mapped_column(Enum('up', 'down', 'offline', 'unknown'), server_default=text("'unknown'"))
    stamp: Mapped[datetime.datetime] = mapped_column(DateTime, primary_key=True, server_default=text("'0000-00-00 00:00:00'"))


class AptAggregateMonitorNodes(Base):
    __tablename__ = 'apt_aggregate_monitor_nodes'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    hostname: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))


class AptAggregateNodes(Base):
    __tablename__ = 'apt_aggregate_nodes'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    node_id: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    type: Mapped[str] = mapped_column(String(30), server_default=text("''"))
    available: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    reservable: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    updated: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    conflicting_nodes: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptAggregateNodetypeAttributes(Base):
    __tablename__ = 'apt_aggregate_nodetype_attributes'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    type: Mapped[str] = mapped_column(String(30), primary_key=True, server_default=text("''"))
    attrkey: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    attrvalue: Mapped[str] = mapped_column(TINYTEXT)


class AptAggregateNodetypes(Base):
    __tablename__ = 'apt_aggregate_nodetypes'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    type: Mapped[str] = mapped_column(String(30), primary_key=True, server_default=text("''"))
    count: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    free: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    updated: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptAggregateRadioFrontends(Base):
    __tablename__ = 'apt_aggregate_radio_frontends'

    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    node_id: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    iface: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    frontend: Mapped[str] = mapped_column(Enum('TDD', 'FDD', 'none'), primary_key=True, server_default=text("'none'"))
    monitored: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    scanned: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    transmit_frequencies: Mapped[Optional[str]] = mapped_column(Text)
    receive_frequencies: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    rdz_radioport_id: Mapped[Optional[str]] = mapped_column(String(40))
    rdz_monitor_id: Mapped[Optional[str]] = mapped_column(String(40))
    rdz_monitor_radio_id: Mapped[Optional[str]] = mapped_column(String(40))
    rdz_monitor_radioport_id: Mapped[Optional[str]] = mapped_column(String(40))
    rdz_monitor_monitor_id: Mapped[Optional[str]] = mapped_column(String(40))


class AptAggregateRadioInfo(Base):
    __tablename__ = 'apt_aggregate_radio_info'

    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    node_id: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    location: Mapped[str] = mapped_column(String(64), server_default=text("''"))
    itype: Mapped[str] = mapped_column(Enum('FE', 'ME', 'BS', 'PE', 'DD', 'OTA', 'OAI', 'unknown'), server_default=text("'unknown'"))
    hidden: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    radio_type: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    power_id: Mapped[Optional[str]] = mapped_column(String(32))
    cnuc_id: Mapped[Optional[str]] = mapped_column(String(32))
    grouping: Mapped[Optional[str]] = mapped_column(String(32))
    synchronization: Mapped[Optional[str]] = mapped_column(Enum('none', 'White Rabbit', 'GPSDO', 'PTP'), server_default=text("'none'"))
    ue_imsi: Mapped[Optional[str]] = mapped_column(String(32))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    rdz_radio_id: Mapped[Optional[str]] = mapped_column(String(40))
    powder_zone: Mapped[Optional[str]] = mapped_column(String(32))


class AptAggregateRadioLocations(Base):
    __tablename__ = 'apt_aggregate_radio_locations'

    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    location: Mapped[str] = mapped_column(String(64), primary_key=True, server_default=text("''"))
    itype: Mapped[str] = mapped_column(Enum('FE', 'ME', 'BS', 'PE', 'DD', 'OTA', 'OAI', 'unknown'), primary_key=True, server_default=text("'unknown'"))
    latitude: Mapped[Optional[float]] = mapped_column(Float(8))
    longitude: Mapped[Optional[float]] = mapped_column(Float(8))
    mapurl: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    streeturl: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    rdz_location_id: Mapped[Optional[str]] = mapped_column(String(40))


t_apt_aggregate_radio_transmissions = Table(
    'apt_aggregate_radio_transmissions', Base.metadata,
    Column('aggregate_urn', String(128), nullable=False, server_default=text("''")),
    Column('node_id', String(32), nullable=False, server_default=text("''")),
    Column('iface', String(32), nullable=False, server_default=text("''")),
    Column('frontend', Enum('TDD', 'FDD', 'none'), nullable=False, server_default=text("'none'")),
    Column('tstamp', DateTime, nullable=False, server_default=text("'0000-00-00 00:00:00'")),
    Column('frequency', Float(8), nullable=False, server_default=text('0.000')),
    Column('power', Float(8), nullable=False, server_default=text('0.000')),
    Column('center', Float(8), nullable=False, server_default=text('0.0000')),
    Column('abovefloor', Float(8), nullable=False, server_default=text('0.000')),
    Column('violation', TINYINT(1), nullable=False, server_default=text('0')),
    Column('instance_uuid', String(40)),
    Index('frontend', 'aggregate_urn', 'node_id', 'iface', 'frontend'),
    Index('stamp', 'aggregate_urn', 'node_id', 'iface', 'frontend', 'tstamp'),
    Index('uuid', 'instance_uuid')
)


class AptAggregateRadioinfo(Base):
    __tablename__ = 'apt_aggregate_radioinfo'

    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    node_id: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    location: Mapped[str] = mapped_column(String(64), server_default=text("''"))
    installation_type: Mapped[str] = mapped_column(Enum('FE', 'ME', 'BS', 'unknown'), server_default=text("'unknown'"))
    monitored: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    radio_type: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    transmit_frequencies: Mapped[Optional[str]] = mapped_column(Text)
    receive_frequencies: Mapped[Optional[str]] = mapped_column(Text)
    power_id: Mapped[Optional[str]] = mapped_column(String(32))
    cnuc_id: Mapped[Optional[str]] = mapped_column(String(32))
    notes: Mapped[Optional[str]] = mapped_column(Text)


class AptAggregateReservableNodes(Base):
    __tablename__ = 'apt_aggregate_reservable_nodes'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    node_id: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    type: Mapped[str] = mapped_column(String(30), server_default=text("''"))
    available: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    updated: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptAggregateStatus(Base):
    __tablename__ = 'apt_aggregate_status'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    status: Mapped[str] = mapped_column(Enum('up', 'down', 'offline', 'unknown'), server_default=text("'unknown'"))
    last_success: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    last_attempt: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    pcount: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    pfree: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    vcount: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    vfree: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    last_error: Mapped[Optional[str]] = mapped_column(Text)


class AptAggregates(Base):
    __tablename__ = 'apt_aggregates'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    name: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    nickname: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    abbreviation: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    adminonly: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    isfederate: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    isFE: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    ismobile: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    disabled: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    noupdate: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    nomonitor: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    nolocalimages: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    prestageimages: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    panicpoweroff: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    precalcmaxext: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    deferrable: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    updated: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=text("'0000-00-00 00:00:00'"))
    has_datasets: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    does_syncthing: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    reservations: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    canuse_feature: Mapped[Optional[str]] = mapped_column(String(64))
    latitude: Mapped[Optional[float]] = mapped_column(Float(8))
    longitude: Mapped[Optional[float]] = mapped_column(Float(8))
    required_license: Mapped[Optional[int]] = mapped_column(INTEGER(11))
    weburl: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    portals: Mapped[Optional[str]] = mapped_column(SET('emulab', 'aptlab', 'cloudlab', 'phantomnet', 'powder'))
    jsondata: Mapped[Optional[str]] = mapped_column(Text)


class AptAnnouncementInfo(Base):
    __tablename__ = 'apt_announcement_info'
    __table_args__ = (
        Index('aid', 'aid'),
        Index('uid_idx', 'uid_idx')
    )

    aid: Mapped[int] = mapped_column(INTEGER(10), primary_key=True, server_default=text('0'))
    uid_idx: Mapped[int] = mapped_column(INTEGER(10), primary_key=True, server_default=text('0'))
    dismissed: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    clicked: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    seen_count: Mapped[int] = mapped_column(INTEGER(8), server_default=text('0'))


class AptAnnouncements(Base):
    __tablename__ = 'apt_announcements'
    __table_args__ = (
        Index('uid_idx', 'uid_idx'),
    )

    idx: Mapped[int] = mapped_column(INTEGER(10), primary_key=True)
    uuid: Mapped[str] = mapped_column(String(40))
    genesis: Mapped[str] = mapped_column(String(64), server_default=text("'emulab'"))
    portal: Mapped[str] = mapped_column(String(64), server_default=text("'emulab'"))
    priority: Mapped[int] = mapped_column(TINYINT(1), server_default=text('3'))
    retired: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    max_seen: Mapped[int] = mapped_column(INTEGER(8), server_default=text('20'))
    style: Mapped[str] = mapped_column(String(64), server_default=text("'alert-info'"))
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    uid_idx: Mapped[Optional[int]] = mapped_column(INTEGER(10))
    pid_idx: Mapped[Optional[int]] = mapped_column(INTEGER(10))
    text_: Mapped[Optional[str]] = mapped_column('text', MEDIUMTEXT)
    link_label: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    link_url: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    display_start: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    display_end: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptDatasets(Base):
    __tablename__ = 'apt_datasets'
    __table_args__ = (
        Index('plid', 'pid_idx', 'dataset_id', unique=True),
        Index('uuid', 'uuid', unique=True)
    )

    idx: Mapped[int] = mapped_column(INTEGER(10), primary_key=True, server_default=text('0'))
    dataset_id: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    pid: Mapped[str] = mapped_column(String(48), server_default=text("''"))
    pid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    creator_uid: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    creator_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    remote_urn: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    remote_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    state: Mapped[str] = mapped_column(Enum('new', 'valid', 'unapproved', 'grace', 'locked', 'expired', 'busy', 'failed'), server_default=text("'new'"))
    type: Mapped[str] = mapped_column(Enum('stdataset', 'ltdataset', 'imdataset', 'unknown'), server_default=text("'unknown'"))
    fstype: Mapped[str] = mapped_column(String(40), server_default=text("'none'"))
    size: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    read_access: Mapped[str] = mapped_column(Enum('project', 'global'), server_default=text("'project'"))
    write_access: Mapped[str] = mapped_column(Enum('creator', 'project'), server_default=text("'creator'"))
    public: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    shared: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    permanent: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    aggregate_urn: Mapped[Optional[str]] = mapped_column(String(128))
    remote_url: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    updated: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    expires: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    last_used: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    locked: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    locker_pid: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    webtask_id: Mapped[Optional[str]] = mapped_column(String(128))
    error: Mapped[Optional[str]] = mapped_column(Text)
    credential_string: Mapped[Optional[str]] = mapped_column(Text)


class AptDeferredInstances(Base):
    __tablename__ = 'apt_deferred_instances'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    start_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    last_retry: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    retry_until: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptExtensionGroupPolicies(Base):
    __tablename__ = 'apt_extension_group_policies'

    pid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True, server_default=text('0'))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True, server_default=text('0'))
    disabled: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    admin_after_limit: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    pid: Mapped[Optional[str]] = mapped_column(String(48))
    creator: Mapped[Optional[str]] = mapped_column(String(8))
    creator_idx: Mapped[Optional[int]] = mapped_column(MEDIUMINT(8))
    limit: Mapped[Optional[int]] = mapped_column(INTEGER(10))
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptExtensionUserPolicies(Base):
    __tablename__ = 'apt_extension_user_policies'

    uid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True, server_default=text('0'))
    disabled: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    admin_after_limit: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    uid: Mapped[Optional[str]] = mapped_column(String(8))
    creator: Mapped[Optional[str]] = mapped_column(String(8))
    creator_idx: Mapped[Optional[int]] = mapped_column(MEDIUMINT(8))
    limit: Mapped[Optional[int]] = mapped_column(INTEGER(10))
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptGlobalRfranges(Base):
    __tablename__ = 'apt_global_rfranges'

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True)
    freq_low: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    freq_high: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    disabled: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    range_id: Mapped[Optional[str]] = mapped_column(String(32))


class AptInstanceAggregateHistory(Base):
    __tablename__ = 'apt_instance_aggregate_history'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    physnode_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    virtnode_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    deferred: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    retry_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    webtask_id: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    status: Mapped[Optional[str]] = mapped_column(String(32))
    added: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    started: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    destroyed: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deferred_reason: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    last_retry: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    failure_code: Mapped[Optional[int]] = mapped_column(INTEGER(10), server_default=text('0'))
    failure_reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    public_url: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    extension_needpush: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    manifest_needpush: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    prestage_data: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    manifest: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    saved_manifest: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptInstanceAggregates(Base):
    __tablename__ = 'apt_instance_aggregates'

    slivers: Mapped[List["AptInstanceSliverStatus"]] = relationship(
        "AptInstanceSliverStatus",
        primaryjoin = \
        "and_(AptInstanceAggregates.uuid==foreign(AptInstanceSliverStatus.uuid), "+
        "     AptInstanceAggregates.aggregate_urn==foreign(AptInstanceSliverStatus.aggregate_urn))")

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    physnode_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    virtnode_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    deferred: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    retry_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    webtask_id: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    status: Mapped[Optional[str]] = mapped_column(String(32))
    added: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    started: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    destroyed: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deferred_reason: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    last_retry: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    failure_code: Mapped[Optional[int]] = mapped_column(INTEGER(10), server_default=text('0'))
    failure_reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    public_url: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    extension_needpush: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    manifest_needpush: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    prestage_data: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    manifest: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    saved_manifest: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptInstanceBusRoutes(Base):
    __tablename__ = 'apt_instance_bus_routes'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    routeid: Mapped[int] = mapped_column(SMALLINT(5), primary_key=True, server_default=text('0'))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    routedescription: Mapped[Optional[str]] = mapped_column(TINYTEXT)


class AptInstanceExtensionInfo(Base):
    __tablename__ = 'apt_instance_extension_info'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    idx: Mapped[int] = mapped_column(INTEGER(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(16), server_default=text("''"))
    uid: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    uid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    action: Mapped[str] = mapped_column(Enum('request', 'deny', 'info'), server_default=text("'request'"))
    wanted: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    needapproval: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    autoapproved: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    admin: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    tstamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    granted: Mapped[Optional[int]] = mapped_column(INTEGER(10))
    autoapproved_reason: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    autoapproved_metrics: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    maxextension: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    expiration: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    message: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptInstanceFabricSlices(Base):
    __tablename__ = 'apt_instance_fabric_slices'
    __table_args__ = (
        Index('uuid', 'uuid', 'linkname', unique=True),
    )

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    linkname: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    sliceid: Mapped[str] = mapped_column(String(64), primary_key=True, server_default=text("''"))


class AptInstanceFailures(Base):
    __tablename__ = 'apt_instance_failures'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    profile_id: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    profile_version: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    creator: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    creator_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    creator_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    slice_uuid: Mapped[Optional[str]] = mapped_column(String(40))
    pid: Mapped[Optional[str]] = mapped_column(String(48))
    pid_idx: Mapped[Optional[int]] = mapped_column(MEDIUMINT(8))
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    start_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    started: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    stop_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    exitcode: Mapped[Optional[int]] = mapped_column(INTEGER(10), server_default=text('0'))
    exitmessage: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    public_url: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    logfileid: Mapped[Optional[str]] = mapped_column(String(40))
    portal: Mapped[Optional[str]] = mapped_column(Enum('emulab', 'aptlab', 'cloudlab', 'phantomnet', 'powder'))


class AptInstanceHistory(Base):
    __tablename__ = 'apt_instance_history'
    __table_args__ = (
        Index('creator', 'creator'),
        Index('creator_idx', 'creator_idx'),
        Index('destroyed', 'destroyed'),
        Index('foo1', 'creator_idx', 'portal'),
        Index('pid_idx', 'pid_idx'),
        Index('portal', 'portal'),
        Index('portal_creator', 'portal', 'creator_idx'),
        Index('portal_started', 'portal', 'started'),
        Index('profile_id', 'profile_id'),
        Index('profile_id_created', 'profile_id', 'created'),
        Index('servername', 'uuid', 'servername'),
        Index('slice_uuid', 'slice_uuid'),
        Index('started', 'portal', 'started')
    )

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    profile_id: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    profile_version: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    slice_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    creator: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    creator_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    creator_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    expired: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    extension_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    extension_days: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    extension_hours: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    physnode_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    virtnode_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    modify_count: Mapped[int] = mapped_column(INTEGER(11), server_default=text('0'))
    fabric_stitched: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    pid: Mapped[Optional[str]] = mapped_column(String(48))
    pid_idx: Mapped[Optional[int]] = mapped_column(MEDIUMINT(8))
    aggregate_urn: Mapped[Optional[str]] = mapped_column(String(128))
    public_url: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    logfileid: Mapped[Optional[str]] = mapped_column(String(40))
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    start_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    started: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    stop_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    destroyed: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    servername: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    portal: Mapped[Optional[str]] = mapped_column(Enum('emulab', 'aptlab', 'cloudlab', 'phantomnet', 'powder'))
    repourl: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    reponame: Mapped[Optional[str]] = mapped_column(String(40))
    reporef: Mapped[Optional[str]] = mapped_column(String(128))
    repohash: Mapped[Optional[str]] = mapped_column(String(64))
    rspec: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    script: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    params: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    manifest: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    webinfo: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptInstancePredictionInfo(Base):
    __tablename__ = 'apt_instance_prediction_info'

    uid: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    uid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True, server_default=text('0'))
    updated: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    updating: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    json_data: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptInstanceRfrangeHistory(Base):
    __tablename__ = 'apt_instance_rfrange_history'

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True)
    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    freq_low: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    freq_high: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    power: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    type: Mapped[Optional[str]] = mapped_column(Enum('global', 'node', 'iface', 'route'))
    target: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    width: Mapped[Optional[float]] = mapped_column(Float(8))


class AptInstanceRfranges(Base):
    __tablename__ = 'apt_instance_rfranges'

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True)
    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    freq_low: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    freq_high: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    power: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    type: Mapped[Optional[str]] = mapped_column(Enum('global', 'node', 'iface', 'route'))
    target: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    width: Mapped[Optional[float]] = mapped_column(Float(8))
    rdz_grantid: Mapped[Optional[str]] = mapped_column(String(40))
    rdz_claimid: Mapped[Optional[str]] = mapped_column(String(40))
    rdz_status: Mapped[Optional[str]] = mapped_column(String(40))


class AptInstanceSliceStatus(Base):
    __tablename__ = 'apt_instance_slice_status'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    timestamp: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    modified: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=text("'0000-00-00 00:00:00'"))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    slice_data: Mapped[Optional[JSON]] = mapped_column(JSON)


class AptInstanceSliverStatus(Base):
    __tablename__ = 'apt_instance_sliver_status'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    sliver_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    resource_id: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    client_id: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    timestamp: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    modified: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=text("'0000-00-00 00:00:00'"))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    sliver_data: Mapped[Optional[JSON]] = mapped_column(JSON)
    frisbee_data: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptInstances(Base):
    __tablename__ = 'apt_instances'
    __table_args__ = (
        Index('creator', 'creator'),
        Index('creator_idx', 'creator_idx'),
        Index('creator_uuid', 'creator_uuid'),
        Index('pid_idx', 'pid_idx')
    )
    aggregates: Mapped[List["AptInstanceAggregates"]] = relationship(
        "AptInstanceAggregates",
        primaryjoin="AptInstances.uuid==foreign(AptInstanceAggregates.uuid)")
    profile: Mapped["AptProfileVersions"] = relationship(
        "AptProfileVersions",
        primaryjoin=\
        "and_(AptInstances.profile_id==foreign(AptProfileVersions.profileid), "+
        "     AptInstances.profile_version==foreign(AptProfileVersions.version))")

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    profile_id: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    profile_version: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    slice_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    creator: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    creator_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    creator_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    canceled: Mapped[int] = mapped_column(TINYINT(2), server_default=text('0'))
    paniced: Mapped[int] = mapped_column(TINYINT(2), server_default=text('0'))
    admin_lockdown: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    user_lockdown: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    extension_adminonly: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    extension_disabled: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    extension_admin_after_limit: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    extension_requested: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    extension_denied: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    extension_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    extension_days: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    extension_hours: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    physnode_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    virtnode_count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    needupdate: Mapped[int] = mapped_column(TINYINT(3), server_default=text('0'))
    isopenstack: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    fabric_stitched: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    rdz_flags: Mapped[str] = mapped_column(SET('heartbeats', 'rdzinrdz'), server_default=text("''"))
    modify_count: Mapped[int] = mapped_column(INTEGER(11), server_default=text('0'))
    name: Mapped[Optional[str]] = mapped_column(String(16))
    pid: Mapped[Optional[str]] = mapped_column(String(48))
    pid_idx: Mapped[Optional[int]] = mapped_column(MEDIUMINT(8))
    aggregate_urn: Mapped[Optional[str]] = mapped_column(String(128))
    public_url: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    webtask_id: Mapped[Optional[str]] = mapped_column(String(128))
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    start_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    started: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    stop_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    maxextension: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    maxextension_timestamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    status: Mapped[Optional[str]] = mapped_column(String(32))
    status_timestamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled_timestamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    paniced_timestamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    admin_notes: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    extension_code: Mapped[Optional[str]] = mapped_column(String(32))
    extension_reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    extension_history: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    extension_disabled_reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    extension_limit: Mapped[Optional[int]] = mapped_column(INTEGER(10))
    extension_limit_reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    extension_denied_reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    servername: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    portal: Mapped[Optional[str]] = mapped_column(Enum('emulab', 'aptlab', 'cloudlab', 'phantomnet', 'powder'))
    monitor_pid: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    logfileid: Mapped[Optional[str]] = mapped_column(String(40))
    cert: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    privkey: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    sshpubkey: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    repourl: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    reponame: Mapped[Optional[str]] = mapped_column(String(40))
    reporef: Mapped[Optional[str]] = mapped_column(String(128))
    repohash: Mapped[Optional[str]] = mapped_column(String(64))
    rspec: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    update_rspec: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    script: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    params: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    paramdefs: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    manifest: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    openstack_utilization: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    webinfo: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    fabric_sliceid: Mapped[Optional[str]] = mapped_column(String(64))
    rdz_status: Mapped[Optional[str]] = mapped_column(String(32))
    rdz_rdzinfo: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    rdz_rdzinrdzinfo: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    powder_zones: Mapped[Optional[str]] = mapped_column(TINYTEXT)


class AptMobileAggregates(Base):
    __tablename__ = 'apt_mobile_aggregates'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    type: Mapped[Optional[str]] = mapped_column(Enum('bus'))


class AptMobileBusRouteChangeHistory(Base):
    __tablename__ = 'apt_mobile_bus_route_change_history'
    __table_args__ = (
        Index('urn', 'urn', 'idx'),
    )

    idx: Mapped[int] = mapped_column(INTEGER(10), primary_key=True)
    urn: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    busid: Mapped[int] = mapped_column(INTEGER(8), primary_key=True, server_default=text('0'))
    routeid: Mapped[Optional[int]] = mapped_column(SMALLINT(5))
    routedescription: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    route_changed: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptMobileBusRoutes(Base):
    __tablename__ = 'apt_mobile_bus_routes'

    routeid: Mapped[int] = mapped_column(SMALLINT(5), primary_key=True, server_default=text('0'))
    description: Mapped[Optional[str]] = mapped_column(TINYTEXT)


class AptMobileBuses(Base):
    __tablename__ = 'apt_mobile_buses'

    urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    busid: Mapped[int] = mapped_column(INTEGER(8), server_default=text('0'))
    latitude: Mapped[float] = mapped_column(Float(8), server_default=text('0.00000'))
    longitude: Mapped[float] = mapped_column(Float(8), server_default=text('0.00000'))
    speed: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    heading: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    gpsd_latitude: Mapped[float] = mapped_column(Float(12), server_default=text('0.00000000'))
    gpsd_longitude: Mapped[float] = mapped_column(Float(12), server_default=text('0.00000000'))
    gpsd_speed: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    gpsd_heading: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    last_ping: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    last_control_ping: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    last_report: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    routeid: Mapped[Optional[int]] = mapped_column(SMALLINT(5))
    routedescription: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    route_changed: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    location_stamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    gpsd_stamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptNamedRfranges(Base):
    __tablename__ = 'apt_named_rfranges'

    range_id: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    freq_low: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    freq_high: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))


class AptNews(Base):
    __tablename__ = 'apt_news'

    idx: Mapped[int] = mapped_column(INTEGER(11), primary_key=True)
    author_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    title: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    author: Mapped[Optional[str]] = mapped_column(String(32))
    portals: Mapped[Optional[str]] = mapped_column(SET('emulab', 'aptlab', 'cloudlab', 'phantomnet', 'powder'))
    body: Mapped[Optional[str]] = mapped_column(Text)


class AptParameterSets(Base):
    __tablename__ = 'apt_parameter_sets'
    __table_args__ = (
        Index('uid_idx', 'uid_idx', 'profileid', 'name', unique=True),
    )

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True)
    uid: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    uid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    name: Mapped[str] = mapped_column(String(64), server_default=text("''"))
    public: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    global_: Mapped[int] = mapped_column('global', TINYINT(1), server_default=text('0'))
    profileid: Mapped[int] = mapped_column(INTEGER(10), server_default=text('0'))
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    description: Mapped[Optional[str]] = mapped_column(Text)
    version_uuid: Mapped[Optional[str]] = mapped_column(String(40))
    reporef: Mapped[Optional[str]] = mapped_column(String(128))
    repohash: Mapped[Optional[str]] = mapped_column(String(64))
    bindings: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    hashkey: Mapped[Optional[str]] = mapped_column(String(64))


class AptProfileFavorites(Base):
    __tablename__ = 'apt_profile_favorites'

    uid: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    uid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True, server_default=text('0'))
    profileid: Mapped[int] = mapped_column(INTEGER(10), primary_key=True, server_default=text('0'))
    marked: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptProfileImages(Base):
    __tablename__ = 'apt_profile_images'
    __table_args__ = (
        Index('image', 'image'),
        Index('ospid', 'ospid'),
        Index('pid_idx', 'pid_idx')
    )

    name: Mapped[str] = mapped_column(String(64), server_default=text("''"))
    profileid: Mapped[int] = mapped_column(INTEGER(10), primary_key=True, server_default=text('0'))
    version: Mapped[int] = mapped_column(INTEGER(8), primary_key=True, server_default=text('0'))
    pid: Mapped[str] = mapped_column(String(48), server_default=text("''"))
    pid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    client_id: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    image: Mapped[str] = mapped_column(String(256), server_default=text("''"))
    authority: Mapped[Optional[str]] = mapped_column(String(64))
    ospid: Mapped[Optional[str]] = mapped_column(String(64))
    os: Mapped[Optional[str]] = mapped_column(String(128))
    osvers: Mapped[Optional[int]] = mapped_column(INTEGER(8))
    local_pid: Mapped[Optional[str]] = mapped_column(String(48))


class AptProfilePermissions(Base):
    __tablename__ = 'apt_profile_permissions'

    profileid: Mapped[int] = mapped_column(INTEGER(10), primary_key=True, server_default=text('0'))
    permission_type: Mapped[str] = mapped_column(Enum('user', 'group'), primary_key=True, server_default=text("'group'"))
    permission_id: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    permission_idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True, server_default=text('0'))
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    revoked: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptProfileVersions(Base):
    __tablename__ = 'apt_profile_versions'
    __table_args__ = (
        Index('hashkey', 'hashkey'),
        Index('uuid', 'uuid', unique=True)
    )

    name: Mapped[str] = mapped_column(String(64), server_default=text("''"))
    profileid: Mapped[int] = mapped_column(INTEGER(10), primary_key=True, server_default=text('0'))
    version: Mapped[int] = mapped_column(INTEGER(8), primary_key=True, server_default=text('0'))
    pid: Mapped[str] = mapped_column(String(48), server_default=text("''"))
    pid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    creator: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    creator_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    updater: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    updater_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    disabled: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    nodelete: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    uuid: Mapped[str] = mapped_column(String(40))
    portal_converted: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    last_use: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    published: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deleted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    parent_profileid: Mapped[Optional[int]] = mapped_column(INTEGER(8))
    parent_version: Mapped[Optional[int]] = mapped_column(INTEGER(8))
    status: Mapped[Optional[str]] = mapped_column(String(32))
    repourl: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    reponame: Mapped[Optional[str]] = mapped_column(String(40))
    reporef: Mapped[Optional[str]] = mapped_column(String(128))
    repohash: Mapped[Optional[str]] = mapped_column(String(64))
    repokey: Mapped[Optional[str]] = mapped_column(String(64))
    rspec: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    script: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    paramdefs: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    hashkey: Mapped[Optional[str]] = mapped_column(String(64))


class AptProfiles(Base):
    __tablename__ = 'apt_profiles'
    __table_args__ = (
        Index('hashkey', 'hashkey'),
        Index('pidname', 'pid_idx', 'name', 'version', unique=True),
        Index('profileid_version', 'profileid', 'version')
    )

    name: Mapped[str] = mapped_column(String(64), server_default=text("''"))
    profileid: Mapped[int] = mapped_column(INTEGER(10), primary_key=True, server_default=text('0'))
    version: Mapped[int] = mapped_column(INTEGER(8), server_default=text('0'))
    pid: Mapped[str] = mapped_column(String(48), server_default=text("''"))
    pid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    uuid: Mapped[str] = mapped_column(String(40))
    public: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    shared: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    listed: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    topdog: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    no_image_versions: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    disabled: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    nodelete: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    project_write: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    webtask_id: Mapped[Optional[str]] = mapped_column(String(128))
    locked: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    locker_pid: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    lastused: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    usecount: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    examples_portals: Mapped[Optional[str]] = mapped_column(SET('emulab', 'aptlab', 'cloudlab', 'phantomnet', 'powder'))
    hashkey: Mapped[Optional[str]] = mapped_column(String(64))


class AptProjectRfranges(Base):
    __tablename__ = 'apt_project_rfranges'

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True)
    pid: Mapped[str] = mapped_column(String(48), server_default=text("''"))
    pid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True, server_default=text('0'))
    freq_low: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    freq_high: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    disabled: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    range_id: Mapped[Optional[str]] = mapped_column(String(32))


class AptReservationGroupHistory(Base):
    __tablename__ = 'apt_reservation_group_history'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    pid: Mapped[str] = mapped_column(String(48), server_default=text("''"))
    pid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    creator_uid: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    creator_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    forclass: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    start: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    end: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deleted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    portal: Mapped[Optional[str]] = mapped_column(Enum('emulab', 'aptlab', 'cloudlab', 'phantomnet', 'powder'))
    reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptReservationGroupReservationData(Base):
    __tablename__ = 'apt_reservation_group_reservation_data'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    type: Mapped[str] = mapped_column(String(30), primary_key=True, server_default=text("''"))
    jsondata: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptReservationGroupReservationHistory(Base):
    __tablename__ = 'apt_reservation_group_reservation_history'
    __table_args__ = (
        Index('agguuid', 'uuid', 'aggregate_urn', 'type'),
    )

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True)
    uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    aggregate_urn: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    remote_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    type: Mapped[str] = mapped_column(String(30), server_default=text("''"))
    count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    submitted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    approved: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deleted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptReservationGroupReservations(Base):
    __tablename__ = 'apt_reservation_group_reservations'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    remote_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    type: Mapped[str] = mapped_column(String(30), primary_key=True, server_default=text("''"))
    count: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    noidledetection_needpush: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    using: Mapped[Optional[int]] = mapped_column(SMALLINT(5))
    utilization: Mapped[Optional[int]] = mapped_column(SMALLINT(5))
    submitted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    approved: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    approved_pushed: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled_pushed: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    cancel_canceled: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deleted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deleted_pushed: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    jsondata: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptReservationGroupRfReservationHistory(Base):
    __tablename__ = 'apt_reservation_group_rf_reservation_history'
    __table_args__ = (
        Index('uuids', 'uuid', 'freq_uuid'),
    )

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True)
    uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    freq_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    freq_low: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    freq_high: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    submitted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    approved: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deleted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptReservationGroupRfReservations(Base):
    __tablename__ = 'apt_reservation_group_rf_reservations'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    freq_uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    freq_low: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    freq_high: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    submitted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    approved: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    rdz_claimid: Mapped[Optional[str]] = mapped_column(String(40))


class AptReservationGroupRouteReservationHistory(Base):
    __tablename__ = 'apt_reservation_group_route_reservation_history'
    __table_args__ = (
        Index('uuids', 'uuid', 'route_uuid'),
    )

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True)
    uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    route_uuid: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    routeid: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    routename: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    submitted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    approved: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deleted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptReservationGroupRouteReservations(Base):
    __tablename__ = 'apt_reservation_group_route_reservations'

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    route_uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    routeid: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    routename: Mapped[Optional[str]] = mapped_column(TINYTEXT)
    submitted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    approved: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptReservationGroups(Base):
    __tablename__ = 'apt_reservation_groups'

    reservations: Mapped[List["AptReservationGroupReservations"]] = relationship(
        "AptReservationGroupReservations",
        primaryjoin="AptReservationGroups.uuid==foreign(AptReservationGroupReservations.uuid)")

    ranges: Mapped[List["AptReservationGroupRfReservations"]] = relationship(
        "AptReservationGroupRfReservations",
        primaryjoin="AptReservationGroups.uuid==foreign(AptReservationGroupRfReservations.uuid)")

    routes: Mapped[List["AptReservationGroupRouteReservations"]] = relationship(
        "AptReservationGroupRouteReservations",
        primaryjoin="AptReservationGroups.uuid==foreign(AptReservationGroupRouteReservations.uuid)")

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True, server_default=text("''"))
    pid: Mapped[str] = mapped_column(String(48), server_default=text("''"))
    pid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    gid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    creator_uid: Mapped[str] = mapped_column(String(8), server_default=text("''"))
    creator_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    forclass: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    start: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    end: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    created: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    canceled: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    deleted: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    noidledetection: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    locked: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    locker_pid: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    notified: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    portal: Mapped[Optional[str]] = mapped_column(Enum('emulab', 'aptlab', 'cloudlab', 'phantomnet', 'powder'))
    reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)
    powder_zones: Mapped[Optional[str]] = mapped_column(TINYTEXT)


class AptReservationHistoryActions(Base):
    __tablename__ = 'apt_reservation_history_actions'
    __table_args__ = (
        Index('agguuid', 'aggregate_urn', 'reservation_uuid'),
    )

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True)
    aggregate_urn: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    action: Mapped[str] = mapped_column(Enum('validate', 'submit', 'approve', 'delete', 'cancel', 'restore'), server_default=text("'validate'"))
    reservation_uuid: Mapped[Optional[str]] = mapped_column(String(40))
    stamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptReservationHistoryDetails(Base):
    __tablename__ = 'apt_reservation_history_details'
    __table_args__ = (
        Index('agguuid', 'aggregate_urn', 'reservation_uuid'),
    )

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True, server_default=text('0'))
    aggregate_urn: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    pid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    gid_idx: Mapped[int] = mapped_column(MEDIUMINT(8), server_default=text('0'))
    nodes: Mapped[int] = mapped_column(SMALLINT(5), server_default=text('0'))
    type: Mapped[str] = mapped_column(String(30), server_default=text("''"))
    refused: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    approved: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    reservation_uuid: Mapped[Optional[str]] = mapped_column(String(40))
    pid: Mapped[Optional[str]] = mapped_column(String(48))
    gid: Mapped[Optional[str]] = mapped_column(String(32))
    uid: Mapped[Optional[str]] = mapped_column(String(8))
    uid_idx: Mapped[Optional[int]] = mapped_column(MEDIUMINT(8))
    stamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    start: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    end: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    reason: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)


class AptRfrangeSets(Base):
    __tablename__ = 'apt_rfrange_sets'

    idx: Mapped[int] = mapped_column(MEDIUMINT(8), primary_key=True)
    setname: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    freq_low: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    freq_high: Mapped[float] = mapped_column(Float(8), server_default=text('0.00'))
    disabled: Mapped[int] = mapped_column(TINYINT(1), server_default=text('0'))
    range_id: Mapped[Optional[str]] = mapped_column(String(32))


class AptSasGrantState(Base):
    __tablename__ = 'apt_sas_grant_state'
    __table_args__ = (
        Index('grantid', 'cbsdid', 'grantid', unique=True),
    )

    cbsdid: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    idx: Mapped[int] = mapped_column(INTEGER(10), primary_key=True)
    grantid: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    state: Mapped[Optional[str]] = mapped_column(Enum('granted', 'authorized', 'suspended', 'terminated'))
    updated: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    freq_low: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    freq_high: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    interval: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))
    expires: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    transmitExpires: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)


class AptSasRadioState(Base):
    __tablename__ = 'apt_sas_radio_state'
    __table_args__ = (
        Index('cbsdid', 'cbsdid', unique=True),
    )

    aggregate_urn: Mapped[str] = mapped_column(String(128), primary_key=True, server_default=text("''"))
    node_id: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("''"))
    fccid: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    serial: Mapped[str] = mapped_column(String(32), server_default=text("''"))
    state: Mapped[Optional[str]] = mapped_column(Enum('idle', 'unregistered', 'registered'), server_default=text("'idle'"))
    updated: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    cbsdid: Mapped[Optional[str]] = mapped_column(String(128))
    locked: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    locker_pid: Mapped[Optional[int]] = mapped_column(INTEGER(11), server_default=text('0'))


