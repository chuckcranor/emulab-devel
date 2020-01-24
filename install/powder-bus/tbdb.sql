UPDATE images set architecture='x86_64';

REPLACE INTO `node_types`
  VALUES ('power','powduino',NULL,NULL,NULL,0,0,0,0,0,0,0,0,0,0,0,0);
REPLACE INTO `node_type_attributes`
  VALUES ('powduino','rebootable','0','boolean');
REPLACE INTO `node_type_attributes`
  VALUES ('powduino','imageable','0','boolean');
REPLACE into `nodes` set
      node_id='powduino',phys_nodeid='powduino',
      type='powduino',role='powerctrl';
REPLACE into `outlets` set
      node_id='ed1-real',power_id='powduino',outlet='0';
REPLACE into node_attributes
  VALUES ('ed1', 'reservation_autoapprove_limit', '0', '0');
REPLACE into node_attributes
  VALUES ('n300-1', 'reservation_autoapprove_limit', '0', '0');

REPLACE INTO `interface_types` VALUES ('P2PLTE',100000,1,'NA','NA',1,'Wireless');
REPLACE INTO `interface_capabilities` VALUES ('P2PLTE','protocols','P2PLTE');
REPLACE INTO `interface_capabilities` VALUES ('P2PLTE','P2PLTE_defspeed','10000');
REPLACE INTO `interface_capabilities` VALUES ('P2PLTE','overtheair','1');
