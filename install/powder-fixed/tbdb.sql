INSERT INTO `node_types`
  VALUES ('power','powduino',NULL,NULL,NULL,0,0,0,0,0,0,0,0,0,0,0,0);
INSERT INTO `node_type_attributes`
  VALUES ('powduino','rebootable','0','boolean');
INSERT INTO `node_type_attributes`
  VALUES ('powduino','imageable','0','boolean');
INSERT into `nodes` set
      node_id='powduino',phys_nodeid='powduino',
      type='powduino',role='powerctrl';
INSERT into `outlets` set
      node_id='nuc1',power_id='powduino',outlet='0';
INSERT into `outlets` set
      node_id='nuc2',power_id='powduino',outlet='1';
INSERT into `outlets` set
      node_id='iris1',power_id='powduino',outlet='2';
