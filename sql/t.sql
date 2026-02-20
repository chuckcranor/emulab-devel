insert into apt_aggregates set 
  urn='urn:publicid:IDN+telemetry.powderwireless.net+authority+cm',
  name='Mobile Telemetry', 
  nickname='Telemetry', 
  abbreviation='Telemetry', 
  weburl='https://www.telemetry.powderwireless.net', 
  updated=now(),has_datasets=0,reservations=0,ismobile=1,
  noupdate=1,nomonitor=1,disabled=1,adminonly=1,nolocalimages=1,
  prestageimages=1,deferrable=1,panicpoweroff=1,
  portals='emulab';
  
insert into apt_aggregate_status set 
  urn='urn:publicid:IDN+telemetry.powderwireless.net+authority+cm',
  status='up';

insert into apt_mobile_aggregates set
  urn='urn:publicid:IDN+telemetry.powderwireless.net+authority+cm',
  type='bus';

insert into apt_mobile_buses set
  urn='urn:publicid:IDN+telemetry.powderwireless.net+authority+cm',
  busid='4209';


insert into apt_mobile_aggregates set
  urn='urn:publicid:IDN+leefedlab.testbed.emulab.net+authority+cm',
  type='bus';

replace into apt_mobile_buses set
  urn='urn:publicid:IDN+leefedlab.testbed.emulab.net+authority+cm',
  busid='6969', last_report=now(), routeid=null,routedescription=null,
  heading=0,location_stamp=now();

replace into apt_mobile_buses set
  urn='urn:publicid:IDN+leefedlab.testbed.emulab.net+authority+cm',
  busid='6969', last_report=now(), routeid=65,routedescription='Blue Detour',
  route_changed=now(), latitude='40.7585',longitude='-111.839', speed=0,
  heading=0,location_stamp=now();

update apt_aggregates set ismobile=1 where nickname='LeighTest';

replace into apt_mobile_bus_routes values
  (19, "Purple"),
  (64, "Green") ,
  (65, "Blue Detour"),
  (66, "Guardsman Direct"),
  (68, "Red Detour"),
  (72, "Orange");

insert into apt_mobile_aggregates set
  urn='urn:publicid:IDN+bus-test.powderwireless.net+authority+cm',
  type='bus';

replace into apt_mobile_buses set
  urn='urn:publicid:IDN+bus-test.powderwireless.net+authority+cm',
  busid='6996';



insert into apt_aggregates set 
  urn='urn:publicid:IDN+leebuslab.testbed.emulab.net+authority+cm',
  name='Leigh Phony Bus', 
  nickname='PhonyBus', 
  abbreviation='PhonyBus', 
  weburl='https://www.leebuslab.testbed.emulab.net', 
  updated=now(),has_datasets=0,reservations=0,ismobile=1,
  noupdate=1,nomonitor=1,disabled=0,adminonly=1,nolocalimages=1,
  prestageimages=1,deferrable=1,panicpoweroff=1,
  portals='cloudlab,powder';
  
insert into apt_aggregate_status set 
  urn='urn:publicid:IDN+leebuslab.testbed.emulab.net+authority+cm',
  status='up';

insert into apt_mobile_aggregates set
  urn='urn:publicid:IDN+leebuslab.testbed.emulab.net+authority+cm',
  type='bus';

replace into apt_mobile_buses set
  urn='urn:publicid:IDN+leebuslab.testbed.emulab.net+authority+cm',
  busid='6970';

update apt_mobile_buses set routeid=65,routedescription='Blue Detour' where busid='6969';
update apt_mobile_buses set routeid=72,routedescription='Orange' where busid='6970';


update apt_mobile_buses set routeid=65,routedescription='Blue Detour' where busid='6970';
update apt_mobile_buses set routeid=72,routedescription='Orange'      where busid='6969';
