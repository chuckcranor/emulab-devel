<?php
#
# Copyright (c) 2000-2015 University of Utah and the Flux Group.
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
chdir("..");
include("defs.php3");
chdir("apt");
include("quickvm_sup.php");
$page_title = "Cluster Status";

SPITHEADER(1);

?>

<div class='container row col-sm-4 col-sm-offset-4'>

  <div class='panel panel-default'>
    <div class='panel-heading'>
      <h3 class='panel-title'>Cluster Status</h3>
    </div> <!-- panel-heading -->
    <div class='panel-body'>
      <table class="table table-condensed">
        <tr>
          <td>CloudLab Utah</td>
          <td>
            <span class="text-success">
              <span class="glyphicon glyphicon-ok"></span>
              </span>
            </td>
          <td>
            <div class="progress" style="width: 50px; height: 1em; margin-top: 5px; margin-bottom: 5px">
              <div class="progress-bar progress-bar-warning" role="progressbar" style="width: 30%;">
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td>InstaGENI UtahDDC</td>
          <td>
            <span class="text-success">
              <span class="glyphicon glyphicon-ok"></span>
              </span>
            </td>
          <td>
            <div class="progress" style="width: 20px; height: 1em; margin-top: 5px; margin-bottom: 5px">
              <div class="progress-bar progress-bar-success" role="progressbar" style="width: 80%;">
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td>CloudLab Wisconsin</td>
          <td><span class="text-warning"><span class="glyphicon glyphicon-minus"></span></span></td>
          <td>
            <div class="progress" style="width: 50px; height: 1em; margin-top: 5px; margin-bottom: 5px">
              <div class="progress-bar progress-bar-success" role="progressbar" style="width: 80%;">
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td>CloudLab Clemson</td>
          <td><span class="text-danger"><span class="glyphicon glyphicon-remove"></span></span></td>
          <td>
            <div class="progress" style="width: 50px; height: 1em; margin-top: 5px; margin-bottom: 5px">
              <div class="progress-bar progress-bar-danger" role="progressbar" style="width: 5%;">
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div> <!-- panel-body -->
  </div> <!-- panel -->

</div> <!-- main container -->

<?

SPITNULLREQUIRE();
SPITFOOTER();
?>
