<?php
#
# Copyright (c) 2000-2016 University of Utah and the Flux Group.
# 
# {{{EMULAB-LICENSE
# 
# This file is part of the Emulab network testbed software.
# 
# This file is free software: you can redistribute it and/or modify it
# under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at
# your option) any later version.
# 
# This file is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
# License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this file.  If not, see <http://www.gnu.org/licenses/>.
# 
# }}}
#

# Dependency lists

$PORTAL_TEMPLATES = array();
$PORTAL_LIBRARIES = array();

# Flag to signal that a requires was spit. For errors.
$spatrequired = 0;

#########################################################################################

function REQUIRE_APTFORMS()
{
  REQUIRE_UNDERSCORE();
  REQUIRE_SUP();
  AddLibrary("js/aptforms.js");
}

function REQUIRE_BILEVEL()
{
  AddLibrary("js/bilevel.js");
}

function REQUIRE_CONTEXTMENU()
{
  AddLibrary("js/lib/bootstrap-contextmenu.js");
}

function REQUIRE_DATEFORMAT()
{
  AddLibrary("js/lib/date.format.js");
}

function REQUIRE_EXTEND()
{
  REQUIRE_UNDERSCORE();
  REQUIRE_SUP();
  AddTemplateList(array("user-extend-modal", "admin-extend-modal", "guest-extend-modal"));
  AddLibrary("js/extend.js");
}

function REQUIRE_FILESIZE()
{
  AddLibrary("js/lib/filesize.min.js");
}

function REQUIRE_FILESTYLE()
{
  AddLibrary("js/lib/filestyle.js");
}

function REQUIRE_FORMHELPERS()
{
  AddLibrary("js/lib/bootstrap-formhelpers.js");
}

function REQUIRE_GENI_AUTH()
{
  AddLibrary("https://www.emulab.net/protogeni/speaks-for/geni-auth.js");
}

function REQUIRE_IDLEGRAPHS()
{
  REQUIRE_UNDERSCORE();
  REQUIRE_SUP();
  REQUIRE_MOMENT();
  AddLibrary("js/idlegraphs.js");
}

function REQUIRE_IMAGE()
{
  REQUIRE_UNDERSCORE();
  REQUIRE_SUP();
  REQUIRE_FILESIZE();
  AddTemplate("imaging-modal");
  AddLibrary("js/image.js");
}

function REQUIRE_JACKS()
{
  AddLibrary("https://www.emulab.net/protogeni/jacks-utah/js/jacks.js");
}

function REQUIRE_JACKS_EDITOR()
{
  REQUIRE_UNDERSCORE();
  REQUIRE_JACKS();
  AddTemplate("edit-modal");
  AddTemplate("edit-inline");
  AddLibrary("js/JacksEditor.js");
}

function REQUIRE_JQUERY_STEPS()
{
  AddLibrary("js/lib/jquery.steps.min.js");
}

function REQUIRE_LIQUIDFILLGAUGE()
{
  AddLibrary("js/liquidFillGauge.js");
}

function REQUIRE_MARKED()
{
  AddLibrary("js/lib/marked.js");
}

function REQUIRE_MOMENT()
{
  AddLibrary("js/lib/moment.js");
}

function REQUIRE_OPENSTACKGRAPHS()
{
  REQUIRE_UNDERSCORE();
  REQUIRE_SUP();
  REQUIRE_MOMENT();
  AddLibrary("js/openstackgraphs.js");
}

function REQUIRE_PPWIZARDSTART()
{
  REQUIRE_UNDERSCORE();
  REQUIRE_SUP();
  REQUIRE_JACKS_EDITOR();
  AddTemplate("ppform-wizard");
  AddTemplate("ppform-wizard-body");
  AddTemplate("choose-am");
  AddLibrary("js/ppwizardstart.js");
}

function REQUIRE_SUP()
{
  REQUIRE_DATEFORMAT();
  REQUIRE_MARKED();
  REQUIRE_JACKS();
  AddLibrary("js/quickvm_sup.js");
}

function REQUIRE_UNDERSCORE()
{
  AddLibrary("js/lib/underscore-min.js");
}

function REQUIRE_URITEMPLATE()
{
  AddLibrary("js/lib/uritemplate.js");
}

function REQUIRE_WIZARD_TEMPLATE()
{
  REQUIRE_UNDERSCORE();
  AddLibrary("js/wizard-template.js");
}

#########################################################################################

function SPITREQUIRE($main, $extras = "")
{
    global $spatrequired, $PORTAL_LIBRARIES;
    
    echo $extras;
    echo "<script src='js/lib/bootstrap.js'></script>\n";
    AddLibrary($main);
    EchoLibraryList($PORTAL_LIBRARIES);
    $spatrequired = 1;
}

function SPITNULLREQUIRE()
{
    REQUIRE_SUP();
    SPITREQUIRE("js/main.js");
}

function SPITREQUIRE_DATASET()
{
    REQUIRE_UNDERSCORE();
    REQUIRE_SUP();
    REQUIRE_MOMENT();
    REQUIRE_APTFORMS();
    SPITREQUIRE("js/create-dataset.js",
                "<script src='js/lib/jquery-ui.js'></script>");
}

#########################################################################################


#
# Echos a plaintext <script> tag with a base64-encoded template inside.
# The <script> tag has an id of $baseName. The template is loaded from
# the path 'template/$baseName.html'
#
function EchoTemplate($key, $value)
{
    echo "\n<script type='text/plain' id='" . $key . "'>\n";
#    echo base64_encode(file_get_contents("template/" . $baseName . ".html")) . "\n";
    echo base64_encode(file_get_contents($value)) . "\n";
    echo "</script>\n";
}

function EchoTemplateList($nameList)
{
    foreach ($nameList as $key => $value) {
        EchoTemplate($key, $value);
    }
}

function AddTemplate($baseName)
{
  global $PORTAL_TEMPLATES;
#  array_push($PORTAL_TEMPLATES, $baseName);
  $PORTAL_TEMPLATES[$baseName] = "template/" . $baseName . ".html";
}

function AddTemplateKey($key, $location)
{
  global $PORTAL_TEMPLATES;
  $PORTAL_TEMPLATES[$key] = $location;
}

function AddTemplateList($nameList)
{
  global $PORTAL_TEMPLATES;
  foreach ($nameList as $index => $name) {
    AddTemplate($name);
#    array_push($PORTAL_TEMPLATES, $name);
  }
}

function AddLibrary($baseName)
{
  global $PORTAL_LIBRARIES;
  $found = 0;
  foreach ($PORTAL_LIBRARIES as $index => $name) {
    if ($name === $baseName) {
      $found = 1;
      break;
    }
  }
  if ($found != 1) {
    array_push($PORTAL_LIBRARIES, $baseName);
  }
}

function EchoLibraryList($nameList)
{
    foreach ($nameList as $index => $name) {
      echo "<script src='$name'></script>\n";
    }
}
