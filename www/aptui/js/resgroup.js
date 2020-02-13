$(function ()
{
    'use strict';

    var template_list   = ["resgroup", "reserve-faq", "range-list",
			   "route-list",
			   "reservation-graph", "oops-modal", "waitwait-modal",
			   "resusage-graph"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var mainTemplate    = _.template(templates["resgroup"]);
    var graphTemplate   = _.template(templates["reservation-graph"]);
    var usageTemplate   = _.template(templates["resusage-graph"]);
    var rangeTemplate   = _.template(templates["range-list"]);
    var routeTemplate   = _.template(templates["route-list"]);
    var projlist     = null;
    var amlist       = null;
    var routelist    = null;
    var FEs          = {};	    // Powder thing
    var Radios       = {};	    // Powder thing
    var isadmin      = false;
    var editing      = false;
    var buttonstate  = "check";
    var forecasts    = {};
    var routeforecast= null;
    var allranges    = [];
    var allroutes    = [];
    var IDEAL_STARTHOUR = 7;	// 7am start time preferred.

    var RouteColors = {
	"Red Detour"       : "red",
	"Blue Detour"      : "blue",
	"Green"            : "green",
	"Purple"           : "purple",
	"Orange"           : "orange",
	"Guardsman Direct" : "pink",
    };

    var addClusterRowString = 
	' <tbody data-uuid="<%- remote_uuid %>" class="new-cluster">' +
	'    <tr>' +
	'      <td>' +
	'        <div>' +
	'  	   <select class="form-control cluster-select"' +
	'	   	   placeholder="Please Select">' +
	'	     <option value="">Select Cluster</option>' +
	'	     <% _.each(amlist, function(details, urn) { %>' +
	'	       <option' +
	'		   <% if (urn == cluster) { %>' +
	'		   selected' +
	'		   <% } %>' +
	'		   value="<%= urn %>"><%= details.name %>' +
	'	       </option>' +
	'	     <% }); %>' +
	'	   </select>' +
	'         <span class="form-group-sm hidden has-error cluster-error"> '+
	'           <label class="control-label">Error</label></span>' +
	'        </div>' +
	'      </td>' +
	'      <td>' +
	'       <div> ' +
	'	  <select class="form-control hardware-select"' +
	'	  	placeholder="Select Hardware">' +
	'	    <option value="">Select Hardware</option>' +
	'	  </select>' +
	'         <span class="form-group-sm hidden has-error hardware-error">'+
	'           <label class="control-label">Error</label></span>' +
	'       </div> '+
	'      </td>' +
	'      <td>' +
	'       <div> ' +
	'	  <input placeholder="#Nodes"' +
	'	         value="<%- count %>"' +
	'	         size="4"' +
	'	         class="form-control node-count"' +
	'	         type="text">' +
	'         <span class="form-group-sm hidden has-error count-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'       </div> '+
	'      </td>' +
	'      <td style="width: 16px; padding-right: 0px;">' +
	'        <button type="button" ' +
	'                class="btn btn-xs btn-default add-cluster hidden" ' +
	'                style="">' +
 	'           <span class="glyphicon glyphicon-plus" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Add a new reservation row"></span>' +
	'        </button>' +
	'        <button type="button" ' +
	'                class="btn btn-xs btn-default delete-cluster hidden"' +
	'                style="">' +
 	'           <span class="glyphicon glyphicon-minus" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Remove this reservation row"></span>' +
	'        </button>' +
	'      </td>' +
	'    </tr>' +
	'    <tr class="error-row">' +
	'      <td colspan=4 class="reservation-error">' +
	'         <span class="form-group-sm hidden has-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'      </td>' +
	'    </tr>' +
	'   </tbody>'; 
	
    var addClusterRowTemplate  = _.template(addClusterRowString);

    // When editing, use readonly inputs.
    var clusterRowString = 
	' <tbody data-uuid="<%- remote_uuid %>" class="existing-cluster">' +
	'    <tr>' +
	'     <td>' +
	'       <div readonly data-urn="<%- cluster_urn %>"' +
	'            class="form-control cluster-selected">' +
	'          <%- cluster %></div>' +
	'     </td>' +
	'     <td>' +
	'       <div readonly ' +
	'            class="form-control hardware-selected">' +
	'         <%- type %></div>' +
	'     </td>' +
	'     <td style="width: 70px !important;">' +
	'      <div>' +
	'       <input type=text ' +
	'	       value="<%- count %>"' +
	'              class="form-control node-count">' +
	'      </div>' +
	'     </td>' +
	'     <td style="width: 16px; padding-right: 0px;">' +
	'       <button type="button" ' +
	'               class="btn btn-xs btn-default add-cluster hidden" ' +
	'               style="">' +
 	'          <span class="glyphicon glyphicon-plus" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Add a new reservation row"></span>' +
	'       </button>' +
	'       <button type="button" ' +
	'               class="btn btn-xs btn-default delete-reservation ' +
	'                      hidden" ' +
	'               style="color: red;">' +
 	'          <span class="glyphicon glyphicon-remove" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Delete this cluster reservation"></span>' +
	'       </button>' +
	'     </td>' +
	'     <% if (window.ISADMIN) { %> ' +
	'       <td style="width: 16px; padding-right: 0px;">' +
	'         <a type="button" target=_blank ' +
	'            class="btn btn-xs btn-default" ' +
	'            href="reserve.php?force=1&edit=1&uuid=<%- remote_uuid %>' +
	'&cluster=<%- cluster %>">' +
 	'          <span class="glyphicon glyphicon-link"></span>' +
	'         </a>' +
	'       </td>' +
	'     <% } %>' +
	'    </tr>' +
	'    <tr class="underused-row">' +
	'      <td colspan=4 class="underused-warning">' +
	'         <span class="form-group-sm hidden has-warning"> ' +
	'           <label class="control-label">' +
	'            The reservation above is using only ' +
	'             <span class="using-count"><%- using %></span> node(s). ' +
	'           </label>' +
	'         </span>' +
	'      </td>' +
	'    </tr>' +
	'    <tr class="error-row">' +
	'      <td colspan=4 class="reservation-error">' +
	'         <span class="form-group-sm hidden has-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'      </td>' +
	'    </tr>'; 
	'  </body>'; 
    
    var clusterRowTemplate  = _.template(clusterRowString);

    var addFrequencyRowString = 
	' <tbody data-uuid="<%- freq_uuid %>" class="new-range">' +
	'    <tr>' +
	'      <td>' +
	'       <div> ' +
	'	  <input placeholder="Lower Frequency"' +
	'	         value="<%- freq_low %>"' +
	'	         size="8"' +
	'	         class="form-control freq-low"' +
	'	         type="text">' +
	'         <span class="form-group-sm hidden has-error ' +
	'                      freq-low-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'       </div> '+
	'      </td>' +
	'      <td>' +
	'       <div> ' +
	'	  <input placeholder="Upper Frequency"' +
	'	         value="<%- freq_high %>"' +
	'	         size="8"' +
	'	         class="form-control freq-high"' +
	'	         type="text">' +
	'         <span class="form-group-sm hidden has-error ' +
	'                      freq-high-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'       </div> '+
	'      </td>' +
	'      <td style="width: 16px; padding-right: 0px;">' +
	'        <button type="button" ' +
	'                class="btn btn-xs btn-default add-range hidden" ' +
	'                style="">' +
 	'           <span class="glyphicon glyphicon-plus" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Add a new reservation row"></span>' +
	'        </button>' +
	'        <button type="button" ' +
	'                class="btn btn-xs btn-default delete-range hidden"' +
	'                style="">' +
 	'           <span class="glyphicon glyphicon-minus" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Remove this reservation row"></span>' +
	'        </button>' +
	'      </td>' +
	'    </tr>' +
	'    <tr class="error-row">' +
	'      <td colspan=4 class="reservation-error">' +
	'         <span class="form-group-sm hidden has-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'      </td>' +
	'    </tr>' +
	'   </tbody>'; 
	
    var addFrequencyRowTemplate  = _.template(addFrequencyRowString);

    // When editing, use readonly inputs.
    var frequencyRowString = 
	' <tbody data-uuid="<%- freq_uuid %>" class="existing-range">' +
	'    <tr>' +
	'     <td>' +
	'      <div>' +
	'       <input readonly type=text ' +
	'	       value="<%- freq_low %>"' +
	'              class="form-control freq-low">' +
	'      </div>' +
	'     </td>' +
	'     <td>' +
	'      <div>' +
	'       <input readonly type=text ' +
	'	       value="<%- freq_high %>"' +
	'              class="form-control freq-high">' +
	'      </div>' +
	'     </td>' +
	'     <td style="width: 16px; padding-right: 0px;">' +
	'       <button type="button" ' +
	'               class="btn btn-xs btn-default add-range hidden" ' +
	'               style="">' +
 	'          <span class="glyphicon glyphicon-plus" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Add a new reservation row"></span>' +
	'       </button>' +
	'       <button type="button" ' +
	'               class="btn btn-xs btn-default delete-range ' +
	'                      hidden" ' +
	'               style="color: red;">' +
 	'          <span class="glyphicon glyphicon-remove" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Delete this frequency reservation"></span>' +
	'       </button>' +
	'     </td>' +
	'    </tr>' +
	'    <tr class="error-row">' +
	'      <td colspan=4 class="reservation-error">' +
	'         <span class="form-group-sm hidden has-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'      </td>' +
	'    </tr>'; 
	'  </body>'; 
    
    var frequencyRowTemplate  = _.template(frequencyRowString);

    var addRouteRowString = 
	' <tbody data-uuid="<%- route_uuid %>" class="new-route">' +
	'    <tr>' +
	'      <td>' +
	'        <div> ' +
	'  	   <select class="form-control routename"' +
	'	   	   placeholder="Please Select">' +
	'	     <option value="">Select Route</option>' +
	'	     <% _.each(routelist, function(details) { %>' +
	'	       <option' +
	'		   <% if (details.routename == routename) { %>' +
	'		   selected' +
	'		   <% } %>' +
	'		   value="<%= details.routename %>">' +
	'                     <%= details.routename %>' +
	'	       </option>' +
	'	     <% }); %>' +
	'	   </select>' +
	'         <span class="form-group-sm hidden has-error ' +
	'                      routename-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'       </div> '+
	'      </td>' +
	'      <td style="width: 16px; padding-right: 0px;">' +
	'        <button type="button" ' +
	'                class="btn btn-xs btn-default add-route hidden" ' +
	'                style="">' +
 	'           <span class="glyphicon glyphicon-plus" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Add a new reservation row"></span>' +
	'        </button>' +
	'        <button type="button" ' +
	'                class="btn btn-xs btn-default delete-route hidden"' +
	'                style="">' +
 	'           <span class="glyphicon glyphicon-minus" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Remove this reservation row"></span>' +
	'        </button>' +
	'      </td>' +
	'    </tr>' +
	'    <tr class="error-row">' +
	'      <td colspan=4 class="reservation-error">' +
	'         <span class="form-group-sm hidden has-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'      </td>' +
	'    </tr>' +
	'   </tbody>'; 
	
    var addRouteRowTemplate  = _.template(addRouteRowString);

    // When editing, use readonly inputs.
    var routeRowString = 
	' <tbody data-uuid="<%- route_uuid %>" class="existing-route">' +
	'    <tr>' +
	'     <td>' +
	'      <div>' +
	'       <input readonly type=text ' +
	'	       value="<%- routename %>"' +
	'              class="form-control routename">' +
	'      </div>' +
	'     </td>' +
	'     <td style="width: 16px; padding-right: 0px;">' +
	'       <button type="button" ' +
	'               class="btn btn-xs btn-default add-route hidden" ' +
	'               style="">' +
 	'          <span class="glyphicon glyphicon-plus" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Add a new reservation row"></span>' +
	'       </button>' +
	'       <button type="button" ' +
	'               class="btn btn-xs btn-default delete-route ' +
	'                      hidden" ' +
	'               style="color: red;">' +
 	'          <span class="glyphicon glyphicon-remove" ' +
	'		 data-toggle="tooltip" ' +
	' 		 data-container="body" ' +
	'		 data-trigger="hover" ' +
	'		 title="Delete this route reservation"></span>' +
	'       </button>' +
	'     </td>' +
	'    </tr>' +
	'    <tr class="error-row">' +
	'      <td colspan=4 class="reservation-error">' +
	'         <span class="form-group-sm hidden has-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'      </td>' +
	'    </tr>'; 
	'  </body>'; 
    
    var routeRowTemplate  = _.template(routeRowString);

    /*
     * Callback when something changes so that we can toggle the
     * button from Submit to Check.
     */
    function modified_callback()
    {
	console.info("modified_callback");
	ToggleSubmit(true, "check");
	aptforms.MarkFormUnsaved();
	if (editing) {
	    $('#reserve-approve-button').attr("disabled", "disabled");
	}
    }
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	isadmin  = window.ISADMIN;
	editing  = window.EDITING; 
	projlist = JSON.parse(_.unescape($('#projects-json')[0].textContent));
	amlist   = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
	routelist= JSON.parse(_.unescape($('#routelist-json')[0].textContent));
	console.info("amlist", amlist);

	GeneratePageBody();

	// Now we can do this. 
	$('#oops_div').html(oopsString);	
	$('#waitwait_div').html(waitwaitString);

	/*
	 * In edit mode enable the controls.
	 */
	if (editing) {
	    PopulateReservation();
	    // Start out with button disabled until a change.
	    ToggleSubmit(false, "check");
	    
	    $('#reserve-delete-button').click(function (e) {
		e.preventDefault();
		Delete();
	    });
	    $('#reserve-refresh-button').click(function (e) {
		e.preventDefault();
		Refresh();
	    });
	    if (window.ISADMIN) {
		// Bind admin button handlers
		$('#reserve-info-button')
		    .removeClass("hidden")
		    .click(function(e) {
			e.preventDefault();
			InfoOrWarning("info");
		    });
		$('#reserve-warn-button').click(function(e) {
		    e.preventDefault();
		    InfoOrWarning("warn");
		});
		$('#reserve-uncancel-button').click(function(e) {
		    e.preventDefault();
		    Uncancel();
		});
	    }
	}
	else {
	    // Give this a slight delay so that the spinners appear.
	    // Not really sure why they do not.
	    setTimeout(function () {
		LoadReservations();
	    }, 100);
	}

	if (1) {
	    $('#reserve-request-form .findfit-button')
		.click(function (event) {
		    event.preventDefault();
		    FindFit();
		});
	}
    }

    //
    // Moved into a separate function since we want to regen the form
    // after each submit, which happens via ajax on this page. 
    //
    function GeneratePageBody()
    {
	// Generate the template.
	var html = mainTemplate({
	    projects:           projlist,
	    amlist:		amlist,
	    isadmin:		isadmin,
	    editing:		editing,
	    default_pid:        window.PID !== undefined ? window.PID : null,
	});
	html = aptforms.FormatFormFieldsHorizontal(html);
	$('#main-body').html(html);
	$('.faq-contents').html(templates["reserve-faq"]);

	// Add one unassigned row.
	if (!editing) {
	    if (window.FROMRSPEC) {
		// XXX Need slight delay to wait for parent to write the
		// rspec into our DOM. Need to revisit this approach.
		setTimeout(function () {
		    PopulateFromRspec();
		}, 150);
	    }
	    else {
		AddClusterRow();
		// Initially, only POWDER gets to see the range/route tables.
		// But we want to show the range/route tables on existing
		// resgroups, if looking at it from a different portal.
		// See below.
		if (window.ISPOWDER) {
		    AddRangeRow();
		    // For now, only admins see routes
		    if (isadmin) {
			AddRouteRow();
		    }
		}
	    }
	}
	// Graph list(s).
	html = "";
	_.each(amlist, function(details, urn) {
	    var graphid = 'resgraph-' + details.nickname;

	    // POWDER; we draw the FEs in a single combined graph.
	    if (details.isFE) {
		FEs[urn] = details;
		return;
	    }
	    html += graphTemplate({"details"        : details,
				   "graphid"        : graphid,
				   "title"          : details.name,
				   "urn"            : urn,
				   "showhelp"       : true,
				   "showfullscreen" : true});
	});
	$('#reservation-lists').html(html);

	// Handler for the Help button
	$('#reservation-help-button').click(function (event) {
	    event.preventDefault();
	    sup.ShowModal('#reservation-help-modal');
	});
	
	// Handler for the FAQ link.
	$('#reservation-faq-button').click(function (event) {
	    event.preventDefault();
	    sup.HideModal('#reservation-help-modal',
			  function () {
			      sup.ShowModal('#reservation-faq-modal');
			  });
	});
	// Set the manual link since the FAQ is not a template.
	$('#reservation-manual').attr("href", window.MANUAL);

	// Handler for the Reservation Graph Help button
	$('.resgraph-help-button').click(function (event) {
	    event.preventDefault();
	    sup.ShowModal('#resgraph-help-modal');
	});

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    container: 'body'
	});
	// This activates the tooltip subsystem.
	$('[data-toggle="tooltip"]').tooltip({
	    placement: 'auto'
	});
	
	// Handle submit button.
	$('#reserve-submit-button').click(function (event) {
	    event.preventDefault();
	    if (buttonstate == "check") {
		CheckForm();
	    }
	    else {
		Reserve();
	    }
	});
	// Handle modal submit button.
	$('#confirm-reservation #commit-reservation').click(function (event) {
	    if (buttonstate == "submit") {
		Reserve();
	    }
	});

	// Insert datepickers after html inserted.
	$("#reserve-request-form #start_day").datepicker({
	    minDate: 0,		/* earliest date is today */
	    showButtonPanel: true,
	    onSelect: function (dateString, dateobject) {
		DateChange("#start_day");
		modified_callback();
	    }
	});
	$("#reserve-request-form #end_day").datepicker({
	    minDate: 0,		/* earliest date is today */
	    showButtonPanel: true,
	    onSelect: function (dateString, dateobject) {
		DateChange("#end_day");
		modified_callback();
	    }
	});
	$('#admin-override').change(function() {
	    // This is messy; if the admin clicks this to force an approval
	    // we do not want to flip the button from approve to check.
	    if (!editing) {
		modified_callback();
	    }
	});
	$('#idle-detection-checkbox').change(function(event) {
	    ToggleIdleDetection();
	});

	aptforms.EnableUnsavedWarning('#reserve-request-form',
				      modified_callback);
    }

    /*
     * Add a new cluster row.
     */
    function AddClusterRow()
    {
	// Add a single cluster row.
	var html = addClusterRowTemplate({
	    "amlist"  : amlist,
	    "cluster" : "",
	    "count"   : "",
	    "remote_uuid" : sup.newUUID(),
	});
	var row = $(html);

	// Handler for cluster change to show the type list.
	row.find('.cluster-select').change(function (event) {
	    $(this).find('option:selected')
		.each(function() {
		    console.info("cluster change: " + $(this).val());
		    HandleClusterChange(row, $(this).val());
		});
	});

	// Handler for hardware type selector,
	row.find('.hardware-select').change(function (event) {
	    $(this).find('option:selected')
		.each(function() {
		    console.info("hardware change: " + $(this).val());
		    HandleTypeChange(row);
		});
	});
	// Handler for the node count input to catch the change.
	row.find('.node-count').change(function (event) {
	    HandleCountChange(row);
	});
	
	// This activates the tooltip subsystem.
	row.find('[data-toggle="tooltip"]').tooltip({
	    placement: 'auto'
	});
	
	$('#cluster-table').append(row);
	
	/*
	 * Add/Delete clusters. Only the last row gets a add button.
	 * Every row gets a delete button unless there is only a
	 * single row.
	 */
	row.find('.add-cluster')
	    .removeClass("hidden")
	    .click(function (event) {
		AddClusterRow();
	    });
	row.find('.delete-cluster')
	    .removeClass("hidden")
	    .click(function (event) {
		// Kill tooltips since they get left behind if visible.
		row.find('[data-toggle="tooltip"]').tooltip('destroy');
		row.remove();
		if ($('#cluster-table tbody').length == 1) {
		    $('#cluster-table .delete-cluster').hide();
		    $('#cluster-table .add-cluster').show();
		}
		else {
		    $('#cluster-table .delete-cluster').show();
		    $('#cluster-table .add-cluster').show();
		    $('#cluster-table .add-cluster').not(":last").hide();
		}
		modified_callback();
		
	    });
	
	if ($('#cluster-table tbody').length == 1) {
	    $('#cluster-table .delete-cluster').hide();
	}
	else {
	    $('#cluster-table .delete-cluster').show();
	    $('#cluster-table .add-cluster').not(":last").hide();
	}
	return row;
    }

    /*
     * Add a new range row.
     */
    function AddRangeRow(freq_low, freq_high)
    {
	$("#range-table-div").removeClass("hidden");
	
	var html = addFrequencyRowTemplate({
	    "freq_low"    : (freq_low  === undefined ? "" : freq_low),
	    "freq_high"   : (freq_high === undefined ? "" : freq_high),
	    "freq_uuid"   : sup.newUUID(),
	});
	var row = $(html);

	// This activates the tooltip subsystem.
	row.find('[data-toggle="tooltip"]').tooltip({
	    placement: 'auto'
	});
	
	$('#range-table').append(row);

	/*
	 * Three cases to consider for the delete button
	 *  1) New reservation, always start with one new range row
	 *     that cannot be deleted.
	 *  2) Existing reservation with a range, show add button on
	 *     last one. All ranges get a delete button.
	 *  3) Existing reservation with no ranges, treat like case 1.
	 */
	var updateButtons = function () {
	    if (!editing) {
		if ($('#range-table tbody.new-range').length == 1) {
		    $('#range-table .new-range .delete-range').hide();
		}
		else {
		    $('#range-table .new-range .delete-range').show();
		}
	    }
	    else if ($('#range-table tbody.existing-range').length) {
		$('#range-table .new-range .delete-range').show();
	    }
	    else if ($('#range-table tbody.new-range').length == 1) {
		$('#range-table .new-range .delete-range').hide();
	    }
	    else {
		$('#range-table .new-range .delete-range').show();
	    }
	    // Last range always gets an add button
	    $('#range-table .add-range').not(":last").hide();
	    $('#range-table .add-range').last().show();
	    return;
	};
	
	/*
	 * Add/Delete ranges. See above for button handling.
	 */
	row.find('.add-range')
	    .removeClass("hidden")
	    .click(function (event) {
		AddRangeRow();
	    });
	row.find('.delete-range')
	    .removeClass("hidden")
	    .click(function (event) {
		// Kill tooltips since they get left behind if visible.
		row.find('[data-toggle="tooltip"]').tooltip('destroy');
		row.remove();
		updateButtons();
		modified_callback();
	    });
	row.find('input.freq-low, input.freq-high').change(function () {
	    modified_callback();
	});
	// See above
	updateButtons();
    }
    
    /*
     * Add a new route row.
     */
    function AddRouteRow(routename)
    {
	$("#route-table-div").removeClass("hidden");
		    
	var html = addRouteRowTemplate({
	    "routelist"   : routelist,
	    "routename"   : (routename  === undefined ? "" : routename),
	    "route_uuid"  : sup.newUUID(),
	});
	var row = $(html);

	// This activates the tooltip subsystem.
	row.find('[data-toggle="tooltip"]').tooltip({
	    placement: 'auto'
	});

	// Handler to regen the combined graph
	row.find('.routename').change(function (event) {
	    $(this).find('option:selected')
		.each(function() {
		    console.info("route change: " + $(this).val());
		    RegenCombinedGraph();
		});
	});
	$('#route-table').append(row);

	/*
	 * Three cases to consider for the delete button
	 *  1) New reservation, always start with one new route row
	 *     that cannot be deleted.
	 *  2) Existing reservation with a route, show add button on
	 *     last one. All routes get a delete button.
	 *  3) Existing reservation with no routes, treat like case 1.
	 */
	var updateButtons = function () {
	    if (!editing) {
		if ($('#route-table tbody.new-route').length == 1) {
		    $('#route-table .new-route .delete-route').hide();
		}
		else {
		    $('#route-table .new-route .delete-route').show();
		}
	    }
	    else if ($('#route-table tbody.existing-route').length) {
		$('#route-table .new-route .delete-route').show();
	    }
	    else if ($('#route-table tbody.new-route').length == 1) {
		$('#route-table .new-route .delete-route').hide();
	    }
	    else {
		$('#route-table .new-route .delete-route').show();
	    }
	    // Last route always gets an add button
	    $('#route-table .add-route').not(":last").hide();
	    $('#route-table .add-route').last().show();
	    return;
	};
	
	/*
	 * Add/Delete route. See above for button handling.
	 */
	row.find('.add-route')
	    .removeClass("hidden")
	    .click(function (event) {
		AddRouteRow();
	    });
	row.find('.delete-route')
	    .removeClass("hidden")
	    .click(function (event) {
		// Kill tooltips since they get left behind if visible.
		row.find('[data-toggle="tooltip"]').tooltip('destroy');
		row.remove();
		updateButtons();
		modified_callback();
	    });
	row.find('input.routename').change(function () {
	    modified_callback();
	});
	// See above
	updateButtons();
    }
    
    /*
     * When the date selected is today, need to disable the hours
     * before the current hour. Also set the initial hour to a
     * reasonable hour, like 7am since that is a good start work time
     * for most people. Basically, try to avoid unused reservations
     * between midnight and 7am, unless people specifically want that
     * time.
     */
    function DateChange(which)
    {
	var date = $("#reserve-request-form " + which).datepicker("getDate");
	var now = new Date();
	var selecter;

	if (which == "#start_day") {
	    selecter = "#reserve-request-form #start_hour";
	}
	else {
	    selecter = "#reserve-request-form #end_hour";
	}
	// Remember if the user already set the hour.
	var hourset =
	    ($(selecter + " option:selected").val() == "" ? false : true);
	
	if (moment(date).isSame(Date.now(), "day")) {
	    for (var i = 0; i <= now.getHours(); i++) {

		/*
		 * Before we disable the option, see if it is selected.
		 * If so, we want make the user re-select the hour.
		 */
		if ($(selecter + " option:selected").val() == i) {
		    $(selecter).val("");
		}
		$(selecter + " option[value='" + i + "']")
		    .attr("disabled", "disabled");
	    }
	}
	else {
	    for (var i = 0; i <= now.getHours(); i++) {
		$(selecter + " option[value='" + i + "']")
		    .removeAttr("disabled");
	    }
	}
	/*
	 * Ok, init the hour if not set.
	 */
	if (!hourset && !moment(date).isSame(Date.now(), "day")) {
	    $(selecter + ' option[value=' + IDEAL_STARTHOUR + ']')
		.prop('selected', 'selected');
	}
    }

    /*
     * Generate errors in the cluster table.
     */
    function GenerateClusterTableFormErrors(clusters)
    {
	console.info("GenerateClusterTableFormErrors", clusters);

	_.each(clusters, function (cluster, uuid) {
	    if (!_.has(cluster, "errors")) {
		return;
	    }
	    var tbody = $('#cluster-table tbody[data-uuid="' + uuid + '"]');

	    _.each(cluster.errors, function (error, key) {
		var classname;
			    
		if (key == "count") {
		    classname = ".count-error";
		}
		else if (key == "type") {
		    classname = ".hardware-error";
		}
		else if (key == "cluster") {
		    classname = ".cluster-error";
		}
		tbody.find(classname + " label")
		    .html(error);
		tbody.find(classname)
		    .removeClass("hidden");
	    });
	});
    }
    /*
     * Generate errors in the ranges table.
     */
    function GenerateRangeTableFormErrors(ranges)
    {
	console.info("GenerateRangeTableFormErrors", ranges);

	_.each(ranges, function (range, uuid) {
	    if (!_.has(range, "errors")) {
		return;
	    }
	    var tbody = $('#range-table tbody[data-uuid="' + uuid + '"]');

	    _.each(range.errors, function (error, key) {
		var classname;
			    
		if (key == "freq_low") {
		    classname = ".freq-low-error";
		}
		else if (key == "freq_high") {
		    classname = ".freq-high-error";
		}
		tbody.find(classname + " label")
		    .html(error);
		tbody.find(classname)
		    .removeClass("hidden");
	    });
	});
    }
    
    /*
     * Generate errors in the routes table.
     */
    function GenerateRouteTableFormErrors(routes)
    {
	console.info("GenerateRouteTableFormErrors", routes);

	_.each(routes, function (route, uuid) {
	    if (!_.has(route, "errors")) {
		return;
	    }
	    var tbody = $('#route-table tbody[data-uuid="' + uuid + '"]');

	    _.each(route.errors, function (error, key) {
		var classname;
			    
		if (key == "routename") {
		    classname = ".routename-error";
		}
		tbody.find(classname + " label")
		    .html(error);
		tbody.find(classname)
		    .removeClass("hidden");
	    });
	});
    }
    
    /*
     * These are validation errors (not enough nodes, etc).
     */
    function GenerateClusterValidationErrors(clusters)
    {
	_.each(clusters, function (reservation, uuid) {
	    var tbody = $('#cluster-table tbody[data-uuid="' + uuid + '"]');

	    if (_.has(reservation, "errcode")) {
		tbody.find(".reservation-error span label")
		    .html(reservation.output);
		tbody.find(".reservation-error span")
		    .removeClass("has-warning")
		    .addClass("has-error")
		    .removeClass("hidden");
		tbody.removeClass("has-warning has-error")
		    .addClass("has-error");
	    }
	    else if (parseInt(reservation.approved) != 0) {
		tbody.find(".reservation-error span")
		    .addClass("hidden");
	    }
	    else {
		tbody.find(".reservation-error span label")
		    .html("Approval is required");
		tbody.find(".reservation-error span")
		    .addClass("has-warning")
		    .removeClass("has-error")
		    .removeClass("hidden");
		tbody.removeClass("has-warning has-error")
		    .addClass("has-warning");
	    }
	});
    }

    /*
     * These are validation errors (not enough nodes, etc).
     */
    function GenerateRangeValidationErrors(ranges)
    {
	_.each(ranges, function (reservation, uuid) {
	    var tbody = $('#range-table tbody[data-uuid="' + uuid + '"]');

	    if (_.has(reservation, "errcode")) {
		tbody.find(".reservation-error span label")
		    .html(reservation.output);
		tbody.find(".reservation-error span")
		    .removeClass("has-warning")
		    .addClass("has-error")
		    .removeClass("hidden");
		tbody.removeClass("has-warning has-error")
		    .addClass("has-error");
	    }
	    else if (parseInt(reservation.approved) != 0) {
		tbody.find(".reservation-error span")
		    .addClass("hidden");
	    }
	    else {
		tbody.find(".reservation-error span label")
		    .html("Approval is required");
		tbody.find(".reservation-error span")
		    .addClass("has-warning")
		    .removeClass("has-error")
		    .removeClass("hidden");
		tbody.removeClass("has-warning has-error")
		    .addClass("has-warning");
	    }
	});
    }

    /*
     * These are validation errors (not enough nodes, etc).
     */
    function GenerateRouteValidationErrors(routes)
    {
	_.each(routes, function (reservation, uuid) {
	    var tbody = $('#route-table tbody[data-uuid="' + uuid + '"]');

	    if (_.has(reservation, "errcode")) {
		tbody.find(".reservation-error span label")
		    .html(reservation.output);
		tbody.find(".reservation-error span")
		    .removeClass("has-warning")
		    .addClass("has-error")
		    .removeClass("hidden");
		tbody.removeClass("has-warning has-error")
		    .addClass("has-error");
	    }
	    else if (parseInt(reservation.approved) != 0) {
		tbody.find(".reservation-error span")
		    .addClass("hidden");
	    }
	    else {
		tbody.find(".reservation-error span label")
		    .html("Approval is required");
		tbody.find(".reservation-error span")
		    .addClass("has-warning")
		    .removeClass("has-error")
		    .removeClass("hidden");
		tbody.removeClass("has-warning has-error")
		    .addClass("has-warning");
	    }
	});
    }

    /*
     * Generate list of cluster rows for passing to the server.
     */
    function GetClusterRows()
    {
	var clusters = {};

	/*
	 * Collect the cluster rows into an array.
	 */
	$('#cluster-table tbody').each(function () {
	    var tbody   = $(this);
	    var count   = tbody.find(".node-count").val();
	    var uuid    = tbody.data("uuid");
	    var cluster;
	    var type;

	    if (tbody.hasClass("new-cluster")) {
		cluster = tbody.find(".cluster-select option:selected").val();
		type    = tbody.find(".hardware-select option:selected").val();

		// Skip an empty row
		if (cluster == "" || type == "") {
		    return;
		}
	    }
	    else {
		cluster = tbody.find(".cluster-selected").attr("data-urn");
		type    = $.trim(tbody.find(".hardware-selected").text());
	    }
	    clusters[uuid] = {"cluster" : cluster,
			      "type"    : type,
			      "count"   : count,
			      "uuid"    : uuid};
	});
	return clusters;
    }
     
    /*
     * Generate list of range rows for passing to the server.
     */
    function GetRangeRows()
    {
	var ranges = {};

	/*
	 * Collect the range rows into an array.
	 */
	$('#range-table tbody').each(function () {
	    var tbody   = $(this);
	    var low     = tbody.find(".freq-low").val();
	    var high    = tbody.find(".freq-high").val();
	    var uuid    = tbody.data("uuid");
	    var type;

	    // Skip an empty row
	    if (low == "" && high == "") {
		return;
	    }
	    ranges[uuid] = {"freq_low"  : low,
			    "freq_high" : high,
			    "uuid"      : uuid};
	});
	return ranges;
    }
     
    /*
     * Generate list of route rows for passing to the server.
     */
    function GetRouteRows()
    {
	var routes = {};

	/*
	 * Collect the route rows into an array.
	 */
	$('#route-table tbody').each(function () {
	    var tbody   = $(this);
	    var name    = tbody.find(".routename option:selected").val();
	    var uuid    = tbody.data("uuid");

	    console.info(tbody, name, uuid);

	    // Skip an empty row
	    if (name == "") {
		return;
	    }
	    routes[uuid] = {"routename" : name,
			    "uuid"      : uuid};
	});
	return routes;
    }
     
    //
    // Check form validity. This does not check whether the reservation
    // is valid.
    //
    function CheckForm()
    {
	var start    = null;
	var end      = null;
	var clusters = {};
	var ranges   = {};
	var routes   = {};
	
	var checkonly_callback = function(json) {
	    if (json.code) {
		if (json.code != 2) {
		    sup.SpitOops("oops", json.value);
		    return;
		}
		/*
		 * Form errors in the clusters array are processed
		 * here since aptforms.GenerateFormErrors() knows
		 * nothing about them.
		 */
		if (_.has(json.value, "clusters")) {
		    GenerateClusterTableFormErrors(json.value.clusters);
		}
		if (_.has(json.value, "ranges")) {
		    GenerateRangeTableFormErrors(json.value.ranges);
		}
		if (_.has(json.value, "routes")) {
		    GenerateRouteTableFormErrors(json.value.routes);
		}
		return;
	    }
	    // Set the number of days, so that user can then search if
	    // the start/end selected do not work.
	    var hours = end.diff(start ? start : moment(), "hours");
	    var days  = hours / 24;
	    $('#reserve-request-form [name=days]')
		.val(days.toFixed(1));
	    
	    // Now check the actual reservation validity.
	    ValidateReservation(clusters, ranges, routes);
	}
	/*
	 * Before we submit, set the start/end fields to UTC time.
	 */
	var start_day  = $('#reserve-request-form [name=start_day]').val();
	var start_hour = $('#reserve-request-form [name=start_hour]').val();
	if (start_day && !start_hour) {
	    aptforms.GenerateFormErrors('#reserve-request-form',
					{"start" : "Missing hour"});
	    return;
	}
	else if (!start_day && start_hour) {
	    aptforms.GenerateFormErrors('#reserve-request-form',
					{"start" : "Missing day"});
	    return;
	}
	else if (start_day && start_hour) {
	    start = moment(start_day, "MM/DD/YYYY");
	    start.hour(start_hour);
	    $('#reserve-request-form [name=start]').val(start.format());
	}
	var end_day  = $('#reserve-request-form [name=end_day]').val();
	var end_hour = $('#reserve-request-form [name=end_hour]').val();
	if (end_day && !end_hour) {
	    aptforms.GenerateFormErrors('#reserve-request-form',
					{"end" : "Missing hour"});
	    return;
	}
	else if (!end_day && end_hour) {
	    aptforms.GenerateFormErrors('#reserve-request-form',
					{"end" : "Missing day"});
	    return;
	}
	else if (end_day && end_hour) {
	    end = moment(end_day, "MM/DD/YYYY");
	    end.hour(end_hour);
	    $('#reserve-request-form [name=end]').val(end.format());
	}
	// Collect the cluster and range/route rows into an array.
	clusters = GetClusterRows();
	ranges   = GetRangeRows();
	routes   = GetRouteRows();

	if (! (_.size(clusters) || _.size(ranges) || _.size(routes))) {
	    alert("No reservations have been specified");
	    return;
	}
	var args = {
	    "clusters" : clusters,
	    "ranges"   : ranges,
	    "routes"   : routes,
	};
	if (window.ISADMIN && _.size(ranges)) {
	    $('#override-checkbox').removeClass("hidden");

	    if ($('#admin-override').is(":checked")) {
		args["override"] = 1;
	    }
	}
	// Clear (hide) previous cluster table errors
	$('#reserve-request-form .form-group-sm').addClass("hidden");	
	$('#reserve-request-form tbody').removeClass("has-warning has-error");
	
	aptforms.CheckForm('#reserve-request-form', "resgroup",
			   "Validate", checkonly_callback, args);
    }

    // Call back from the graphs to change the dates on a blank form
    function GraphClick(when, type)
    {
	//console.info("graphclick", when, type);
	// Bump to next hour. Will be confusing at midnight.
	when.setHours(when.getHours() + 1);

	if (! editing) {
	    $("#reserve-request-form #start_day").datepicker("setDate", when);
	    $("#reserve-request-form [name=start_hour]").val(when.getHours());
	    if (type !== undefined) {
		if ($('#reserve-request-form ' +
		      '[name=type] option:selected').val() != type) {
		    $('#reserve-request-form ' +
		      '[name=type] option:selected').removeAttr('selected');
		    $('#reserve-request-form [name=type] ' + 
		      'option[value="' + type + '"]')
			.prop("selected", "selected");
		}
	    }
	    $('#reserve-request-form [name=count]').focus();
	    console.info("graphclick");
	    aptforms.MarkFormUnsaved();
	}
    }
    
    // Set the cluster after clicking on a graph.
    // XXX Not using this aymore.
    function SetCluster(nickname, urn)
    {
	//console.info("SetCluster", nickname);
	var id = "resgraph-" + nickname;
	
	if ($('#reservation-lists :first-child').attr("id") != id) {
	    $('#' + id).fadeOut("fast", function () {
		if ($(window).scrollTop()) {
		    $('html, body').animate({scrollTop: '0px'},
					    500, "swing",
					    function () {
						$('#reservation-lists')
						    .prepend($('#' + id));
						$('#' + id)
						    .fadeIn("fast");
					    });
		}
		else {
		    $('#reservation-lists').prepend($('#' + id));
		    $('#' + id).fadeIn("fast");
		}
	    });
	}
	if ($('#reserve-request-form ' +
	      '[name=cluster] option:selected').val() != urn) {
	    $('#reserve-request-form ' +
	      '[name=cluster] option:selected').removeAttr('selected');
	    $('#reserve-request-form ' +
	      '[name=cluster] option[value="' + urn + '"]')
		.prop("selected", "selected");
	    HandleClusterChange(urn);
	    console.info("SetCluster");
	    aptforms.MarkFormUnsaved();
	}
    }

    /*
     * Load anonymized reservations from each am in the list and
     * generate tables.
     */
    function LoadReservations(project)
    {
	var deferred = [];
	if (window.ISPOWDER) {
	    LoadRangeReservations();
	    if (isadmin) {
		LoadRouteReservations();
	    }
	}
	_.each(amlist, function(details, urn) {
	    var callback = function(json) {
		console.log("LoadReservations: " + details.nickname, json);
		var id = "resgraph-" + details.nickname;
		
		// Kill the spinner.
		$('#' + id + ' .resgraph-spinner').addClass("hidden");

		if (json.code) {
		    console.log("Could not get reservation data for " +
				details.name + ": " + json.value);
		    
		    $('#' + id + ' .resgraph-error').html(json.value);
		    $('#' + id + ' .resgraph-error').removeClass("hidden");
		    return;
		}
		ProcessForecast(urn, json.value.forecast);

		// Powder combined graph.
		if (_.has(FEs, urn)) {
		    RegenFEGraph();
		    return;
		}
		// Another special case; seperate out Emulab reservable
		// radios into a different graph using the new graph code.
		if (window.ISPOWDER && details.nickname == "Emulab") {
		    _.each(json.value.forecast, function (stuff, key) {
			if (_.has(details.reservable_nodes, key)) {
			    Radios[key] = stuff;
			    delete json.value.forecast[key];
			}
		    });
		    GenerateRadioGraph();
		}
		
		ShowResGraph({"forecast"  : json.value.forecast,
			      "selector"  : id,
			      "resize"    : true,
			      "skiptypes"      : json.value.prunelist,
			      "click_callback" : function(when, type) {
				  if (!editing) {
				      // Needs work for res groups.
				      //SetCluster(details.nickname, urn);
				  }
				  GraphClick(when, type);
			      }});

		$('#' + id + ' .resgraph-fullscreen')
		    .click(function (event) {
			event.preventDefault();
			// Panel title in the modal.
			$('#resgraph-modal .cluster-name')
			    .html(details.nickname);
			// Clear the existing graph first.
			$('#resgraph-modal svg').html("");
			// Modal needs to show before we can draw the graph.
			$('#resgraph-modal').on('shown.bs.modal', function() {
			    ShowResGraph({"forecast"  : json.value.forecast,
					  "selector"  : "resgraph-modal",
					  "skiptypes" : json.value.prunelist,
					  "click_callback" : GraphClick});
			});
			sup.ShowModal('#resgraph-modal', function () {
			    $('#resgraph-modal').off('shown.bs.modal');
			});
		    });
 	    }
	    var args = {"cluster" : details.nickname};
	    if (project !== undefined) {
		args["project"] = project;
	    }
	    var xmlthing = sup.CallServerMethod(null, "reserve",
						"ReservationInfo", args,
						callback);
	    deferred.push(xmlthing);
	});
	if (window.FROMRSPEC) {
	    $.when.apply($, deferred).then(function() {
		RegenCombinedGraph();
	    });
	}
    }

    //
    // Process the forecast so we use it for reservation fitting.
    //
    function ProcessForecast(cluster, forecast)
    {
	// Each node type
	for (var type in forecast) {
	    // This is an array of objects.
	    var array = forecast[type];

	    for (var i = 0; i < array.length; i++) {
		var data = array[i];
		data.t     = parseInt(data.t);
		data.free  = parseInt(data.free);
		data.held  = parseInt(data.held);
		data.stamp = new Date(parseInt(data.t) * 1000);
	    }

	    // No data or just one data point, nothing to do.
	    if (array.length <= 1) {
		continue;
	    }
	    
	    /*
	     * Gary says there can be duplicate entries for the same time
	     * stamp, and we want the last one. So have to splice those
	     * out before we process. Yuck.
	     */
	    var temp = [];
	    for (var i = 0; i < array.length - 1; i++) {
		var data     = array[i];
		var nextdata = array[i + 1];
		
		if (data.t == nextdata.t) {
		    continue;
		}
		temp.push(data);
	    }
	    temp.push(array[array.length - 1]);
	    forecast[type] = temp;
	}
	//console.info("forecast", cluster, forecast);
	forecasts[cluster] = forecast;
    }

    /*
     * Load the range reservation info.
     */
    function LoadRangeReservations()
    {
	var callback = function(json) {
	    console.log("LoadRangeReservations", json);
	    if (json.code) {
		console.info("Could not get range info");
		return;
	    }
	    if (!_.size(json.value)) {
		return;
	    }
	    allranges = json.value;
	    
	    var html = rangeTemplate({"ranges" : json.value});
	    $('#range-list').html(html).removeClass("hidden");

	    // Format dates with moment before display.
	    $('#range-list .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment(date).format("lll"));
		}
	    });
	    $('#range-list .tablesorter')
		.tablesorter({
		    theme : 'green',
		    // initialize zebra
		    widgets: ["zebra"],
		});
	};

	var xmlthing = sup.CallServerMethod(null, "resgroup",
					    "RangeReservations");
	xmlthing.done(callback);
    }
    
    /*
     * Load the route reservation info.
     */
    function LoadRouteReservations()
    {
	var callback = function(json) {
	    console.log("LoadRouteReservations", json);
	    if (json.code) {
		console.info("Could not get route info");
		return;
	    }
	    routeforecast = json.value.forecast;
	    GenerateRouteGraph();

	    if (!_.size(json.value.list)) {
		return;
	    }
	    if (0) {
		allroutes = json.value.list;
		var html = routeTemplate({"routes" : allroutes});
		$('#route-list').html(html).removeClass("hidden");

		// Format dates with moment before display.
		$('#route-list .format-date').each(function() {
		    var date = $.trim($(this).html());
		    if (date != "") {
			$(this).html(moment(date).format("lll"));
		    }
		});
		$('#route-list .tablesorter')
		    .tablesorter({
			theme : 'green',
			// initialize zebra
			widgets: ["zebra"],
		    });
	    }
	};
	var xmlthing = sup.CallServerMethod(null, "resgroup",
					    "RouteReservations");
	xmlthing.done(callback);
    }
    
    /*
     * Try to find the first fit.
     */
    function FindFit()
    {
	var days  = $('#reserve-request-form [name=days]').val();
	var index = 0;
	var bail  = 0;

	// List of reservation requests.
	var clusters = _.values(GetClusterRows());
	var ranges   = _.values(GetRangeRows());
	var routes   = _.values(GetRouteRows());

	if (!_.size(clusters)) {
	    alert("Need at least one complete cluster definition");
	    return;
	}
	if (! days) {
	    alert("Please provide the number of days");
	    return;
	}
	// Remove old sanity check errors.
	$('#reserve-request-form .form-group-sm').addClass("hidden");

	// Clear old search result.
	$("#reserve-request-form #start_day")
	    .datepicker('setDate', null);
	$("#reserve-request-form #end_day")
	    .datepicker('setDate', null);
	
	// Sanity check.
	for (var i = 0; i < clusters.length; i++) {
	    var count = clusters[i].count;
	    var urn   = clusters[i].cluster;
	    var error;

	    if (count == "") {
		error = "Missing count";
	    }
	    else if (! (isNumber(count) && count > 0)) {
		error = "Invalid count"
	    }
	    if (error) {
		var uuid  = clusters[i].uuid;
		var tbody = $('#cluster-table tbody[data-uuid="' + uuid + '"]');
		
		tbody.find(".count-error label")
		    .html(error);
		tbody.find(".count-error")
		    .removeClass("hidden");
		bail = 1;
	    }
	}
	for (var i = 0; i < ranges.length; i++) {
	    var low   = ranges[i].freq_low;
	    var high  = ranges[i].freq_high;
	    var error;
	    var classname;

	    if (low == "") {
		error = "Missing frequency";
		classname = ".freq-low-error";
	    }
	    else if (! (isNumber(low) && low > 0)) {
		error = "Invalid frequency"
		classname = ".freq-low-error";
	    }
	    else if (high == "") {
		error = "Missing frequency";
		classname = ".freq-high-error";
	    }
	    else if (! (isNumber(high) && high > 0)) {
		error = "Invalid frequency"
		classname = ".freq-high-error";
	    }
	    if (error) {
		var uuid  = ranges[i].uuid;
		var tbody = $('#range-table tbody[data-uuid="' + uuid + '"]');
		
		tbody.find(classname + " label")
		    .html(error);
		tbody.find(classname)
		    .removeClass("hidden");
		bail = 1;
	    }
	}
	if (bail) {
	    return;
	}
	console.info("FindFit: ", days, clusters, ranges, routes);

	/*
	 * Slightly cheesy way to wait for the cluster data to come in.
	 */
	var needwait = function () {
	    var flag = 0;
	    
	    _.each(clusters, function (cluster) {
		if (forecasts[cluster.cluster] === undefined) {
		    flag = 1;
		};
	    });
	    return flag;
	};
	if (needwait()) {
	    sup.ShowWaitWait("Waiting for cluster reservation data");
	    var waitfordata = function() {
		if (! needwait()) {
		    sup.HideWaitWait();
		    FindFit();
		    return;
		}
		setTimeout(function() { waitfordata() }, 200);
	    };
	    setTimeout(function() { waitfordata() }, 200);
	    return;
	}
	/*
	 * Oh, major cheesiness going on here. Take the route rows and
	 * make it look like a cluster and add to the cluster list so that
	 * we process the forecasts in that loop. Do I get a cookie?
	 */
	if (routeforecast != null) {
	    _.each(routes, function (route) {
		clusters.push({"cluster" : "busroutes",
			       "type"    : route.routename,
			       "count"   : 1});
	    });
	    forecasts["busroutes"] = routeforecast;
	    console.info("extend", clusters);
	}
	
	
	/*
	 * Find the first fit for a cluster reservation
	 */
	var findfirst = function (cluster, lower, upper) {
	    var starttime = null;
	    var startdata = null;
	    var enddata   = null;
	    var type      = cluster.type;
	    var count     = cluster.count;

	    console.info("findfirst", type, count, lower);

	    var tmp = forecasts[cluster.cluster][cluster.type].slice(0);
	    console.info("tmp", tmp);
	    while (tmp.length && starttime == null) {
		var data = tmp.shift();

		console.info("baz", data);
		
		if (data.free >= cluster.count) {
		    starttime = data.t;
		    startdata = data;
		    console.info("baz2", startdata, starttime, lower);
		    if (lower) {
			if (tmp.length) {
			    var next = tmp[0];
			    
			    console.info("foo", lower, data, next);

			    if (next.free >= cluster.count &&
				lower >= data.t && lower <= next.t) {
				starttime = lower;
				console.info("fee", starttime);
			    }
			    else if (data.t < lower) {
				console.info("bar");
				starttime = null;
				continue;
			    }
			}
			else {
			    // Last one, has enough nodes, just move past
			    // lower bound and be done.
			    if (0 && starttime < lower) {
				starttime = lower + 60;
			    }
			}
		    }
		    console.info("boop", data, starttime);
		    
		    for (var i = 0; i < tmp.length; i++) {
			var next = tmp[i];

			if (next.free >= cluster.count) {
			    // The next time stamp still has enough nodes,
			    // keep checking until no longer true, so we
			    // have the biggest range possible.
			    continue;
			}
			/*
			 * Okay, next range no longer has enough nodes, but
			 * if the current range is long enough, we are good.
			 */
			if (starttime + (3600 * 24 * days) + 3600 < next.t) {
			    // The next time stamp is beyond the days requested,
			    // so it fits.
			    enddata = next;
			    break;
			}
			// Otherwise, we no longer fit, need to start over.
			starttime = null;
			break;
		    }
		}
	    }
	    var results =
		{"starttime" : starttime,
		 "startdata" : startdata,
		 "endtime"   : (enddata ? enddata.t : null),
		 "enddata"   : enddata,
		};
	    console.info("findfirst return", results);
	    return results;
	};
	var lower = null;
	var fit   = null;
	var loops = 100;  // Avoid infinite loop.
	
	while (!fit && loops) {
	    loops--;
	    fit = findfirst(clusters[0], lower, null);
	    if (!fit.starttime) {
		break;
	    }
	    for (index = 1; index < clusters.length; index++) {
		var results = findfirst(clusters[index],
					fit["starttime"], null);
		if (!results.starttime) {
		    break;
		}
		console.info("fit:" + index,
			     fit.starttime, fit.endtime,
			     fit.startdata, fit.enddata);
		
		/*
		 * If the first avail is beyond the current fit, need
		 * to start over.
		 */
		if (fit["endtime"] && results["starttime"] > fit["endtime"]) {
		    console.info("skip1");
		    fit   = null;
		    lower = results["starttime"];
		    break;
		}
		// Narrow to newest fit.
		if (results["starttime"] > fit["starttime"]) {
		    fit["starttime"] = results["starttime"];
		}
		if (results["endtime"] &&
		    (!fit["endtime"] || results["endtime"] < fit["endtime"])) {
		    fit["endtime"] = results["endtime"];
		}
		// If too narrow, have to keep going.
		if (fit["endtime"] &&
		    (fit["endtime"] - fit["starttime"] < 
		     (3600 * 24 * days) + 3600)) {
		    console.info("skip2");
		    fit   = null;
		    lower = fit["starttime"];
		    break;
		}
	    }
	    if (!fit || _.size(ranges) == 0) {
		continue;
	    }
	    /*
	     * Ok, we have something that works for the clusters, lets look
	     * at the ranges. This is a bit easier since current ranges
	     * include both a start and end time. So if the current fit
	     * above conflicts with a range we want, start over at the end
	     * of the conflicting range. 
	     */
	    for (index = 0; index < ranges.length; index++) {
		var range     = ranges[index];
		var freq_low  = parseFloat(range.freq_low);
		var freq_high = parseFloat(range.freq_high);

		console.info("Range:" + index, freq_low, freq_high);

		for (var r = 0; r < allranges.length; r++) {
		    var existing = allranges[r];
		    var lower    = parseFloat(existing.freq_low);
		    var upper    = parseFloat(existing.freq_high);
		    var starts   = moment(existing.start).unix();
		    var ends     = moment(existing.end).unix();
		    var fitend   = fit.starttime + (3600 * 24 * days) + 3600;

		    console.info("Existing:" + r, lower,upper,starts,ends);

		    // If this range does not overlap in time, keep going
		    if ((fit.starttime < starts && fitend < starts) ||
			(fit.starttime > ends)) {
			continue;
		    }
		    // If this range does not overlap in frequency, keep going
		    if ((freq_low < lower && freq_high < lower) ||
			(freq_low > upper)) {
			continue;
		    }
		    // Does not fit! Move past the conflicting reservation.
		    console.info("Range does not fit");
		    fit   = null;
		    lower = ends + (3600 * 4);
		    break;
		}
		// No point in continuing, start over.
		if (!fit) {
		    break;
		}
	    }
	}
	// enddata can be null if we fit on the last timeline entry.
	console.info("FindFit: ", fit);
	if (!fit.starttime) {
	    console.info("No fit");
	    $("#reserve-request-form #start_day")
		.datepicker('setDate', null);
	    $("#reserve-request-form #end_day")
		.datepicker('setDate', null);
	    alert("Could not find a time that works!");
	    return;
	}
	var starttime = fit.starttime;
	var endtime   = fit.endtime;

	var start = moment(starttime * 1000);
	/*
	 * Need to push out the start to the top of hour.
	 */
	var minutes = (start.hours() * 60) + start.minutes();
	start.hour(Math.ceil(minutes / 60));

	/*
	 * Try to shift the reservation from the middle of the night.
	 * It is okay if we cannot do this, we still want to give the
	 * user the earliest possible reservation.
	 */
	if (start.hour() < IDEAL_STARTHOUR) {
	    var tmp = moment(start);
	    tmp.hour(IDEAL_STARTHOUR);

	    // If no enddata then we can definitely shift it.
	    if (!endtime || tmp.unix() + ((3600 * 24 * days)) < endtime) {
		console.info("Shifting to later start time");
		start = tmp;
	    }
	}
	var end = moment(start.valueOf() + ((3600 * 24 * days) * 1000));

	var start_day  = $('#reserve-request-form [name=start_day]').val();
	var start_hour = $('#reserve-request-form [name=start_hour]').val();
	var end_day    = $('#reserve-request-form [name=end_day]').val();
	var end_hour   = $('#reserve-request-form [name=end_hour]').val();
	var new_start_day  = start.format("MM/DD/YYYY");
	var new_start_hour = start.format("H");
	var new_end_day    = end.format("MM/DD/YYYY");
	var new_end_hour   = end.format("H");

	$('#reserve-request-form [name=start_day]').val(new_start_day);
	$('#reserve-request-form [name=start_hour]').val(new_start_hour);
	$('#reserve-request-form [name=end_day]').val(new_end_day);
	$('#reserve-request-form [name=end_hour]').val(new_end_hour);

	// And if we actually changed anything.
	if (start_day != new_start_day || start_hour != new_start_hour ||
	    end_day != new_end_day || end_hour != new_end_hour) {
	    modified_callback();
	}
    }

    //
    // Validate the reservation. 
    //
    function ValidateReservation(clusters, ranges, routes)
    {
	var callback = function(json) {
	    console.info(json);
	    if (json.code) {
		if (json.code != 2) {
		    sup.SpitOops("oops", json.value);
		    return;
		}
		aptforms.GenerateFormErrors('#reserve-request-form',
					    json.value);
		/*
		 * Form errors in the clusters array are processed
		 * here since aptforms.GenerateFormErrors() knows
		 * nothing about them.
		 */
		if (_.has(json.value, "clusters")) {
		    GenerateClusterTableFormErrors(json.value.clusters);
		}
		if (_.has(json.value, "ranges")) {
		    GenerateRangeTableFormErrors(json.value.ranges);
		}
		if (_.has(json.value, "routes")) {
		    GenerateRouteTableFormErrors(json.value.routes);
		}
		// Make sure we still warn about an unsaved form.
		aptforms.MarkFormUnsaved();
		return;
	    }
	    /*
	     * Now look for actual reservation errors from the target
	     * clusters, which will be reported in the blob we get
	     * back, which is an augmented copy of the clusters array
	     * we sent over.
	     */
	    var results = json.value;
	    var cluster_results, range_results, route_results;
	    
	    if (_.has(results, "cluster_results")) {
		cluster_results = results.cluster_results;
		GenerateClusterValidationErrors(cluster_results.clusters);
	    }
	    if (_.has(results, "range_results")) {
		range_results = json.value.range_results;
		GenerateRangeValidationErrors(range_results.ranges);
	    }
	    if (_.has(results, "route_results")) {
		route_results = json.value.route_results;
		GenerateRouteValidationErrors(route_results.routes);
	    }
	    // User needs to fix things up.
	    if ((cluster_results && cluster_results.errors) ||
		(range_results && range_results.errors) ||
		(route_results && route_results.errors)) {
		return;
	    }
	    
	    // User can submit.
	    ToggleSubmit(true, "submit");
	    // Make sure we still warn about an unsaved form.
	    aptforms.MarkFormUnsaved();

	    if ((cluster_results &&
		 cluster_results.approved != _.size(clusters)) ||
		(range_results &&
		 range_results.approved != _.size(ranges)) ||
		(route_results &&
		 route_results.approved != _.size(routes))) {
		$('#confirm-reservation .needs-approval')
		    .removeClass("hidden");
	    }
	    else {
		$('#confirm-reservation .needs-approval')
		    .addClass("hidden");
	    }
	    sup.ShowModal('#confirm-reservation');
	};
	var args = {
	    "clusters" : clusters,
	    "ranges"   : ranges,
	    "routes"   : routes
	};
	if (window.ISADMIN && _.size(ranges)) {
	    if ($('#admin-override').is(":checked")) {
		args["override"] = 1;
	    }
	}
	// Clear (hide) previous cluster table errors
	$('#reserve-request-form .form-group-sm').addClass("hidden");
	$('#reserve-request-form tbody').removeClass("has-warning has-error");
	
	aptforms.SubmitForm('#reserve-request-form', "resgroup",
			    "Validate", callback,
			    "Checking to see if your request can be "+
			    "accommodated", args);
    }

    /*
     * And do it.
     */
    function Reserve()
    {
	var clusters = {};
	var ranges   = {};
	var routes   = {};
	
	var reserve_callback = function(json) {
	    console.info(json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    /*
	     * Have to look for again for reservation errors from the
	     * target clusters, which will be reported in the blob we
	     * get back, which is an augmented copy of the clusters
	     * array we sent over.
	     */
	    var results = json.value;
	    var cluster_results, range_results, route_results;
	    
	    if (_.has(results, "cluster_results")) {
		cluster_results = results.cluster_results;
		GenerateClusterValidationErrors(cluster_results.clusters);
	    }
	    if (_.has(results, "range_results")) {
		range_results = json.value.range_results;
		GenerateRangeValidationErrors(range_results.ranges);
	    }
	    if (_.has(results, "route_results")) {
		route_results = json.value.route_results;
		GenerateRouteValidationErrors(route_results.routes);
	    }
	    // User needs to fix things up.
	    if ((cluster_results && cluster_results.errors) ||
		(route_results && route_results.errors) ||
		(range_results && range_results.errors)) {
		/*
		 * Partial success. We want to stay here. But if not
		 * editing, we need to shift into edit mode. 
		 */
		if (!editing && _.has(json.value, "uuid")) {
		    editing = true;
		    window.UUID = json.value.uuid;
		}
		/*
		 * The ones that succeeded have a new UUID, Need to change
		 * the table so that an edit operation after error works
		 * correctly (maps to the uuid stored in the DB).
		 */
		if (cluster_results) {
		    _.each(cluster_results.clusters, function (res, uuid) {
			var tbody = $('#cluster-table tbody[data-uuid="' +
				  uuid + '"]');
			if (uuid != res.uuid) {
			    tbody.attr("data-uuid", res.uuid);
			}
		    });
		}
		if (range_results) {
		    _.each(range_results.ranges, function (res, uuid) {
			var tbody = $('#range-table tbody[data-uuid="' +
				  uuid + '"]');
			if (uuid != res.uuid) {
			    tbody.attr("data-uuid", res.uuid);
			}
		    });
		}
		if (route_results) {
		    _.each(route_results.routes, function (res, uuid) {
			var tbody = $('#route-table tbody[data-uuid="' +
				  uuid + '"]');
			if (uuid != res.uuid) {
			    tbody.attr("data-uuid", res.uuid);
			}
		    });
		}
		return;
	    }
	    if (window.FROMRSPEC) {
		window.parent.CloseMyIframe(json.value.uuid);
		return;
	    }
	    window.location.replace("resgroup.php?edit=1" +
				    "&uuid=" + json.value.uuid);
	    return;
	};
	// Collect the cluster rows into an array.
	clusters = GetClusterRows();
	ranges   = GetRangeRows();
	routes   = GetRouteRows();

	if (! (_.size(clusters) || _.size(ranges) || _.size(routes))) {
	    alert("No reservations have been specified");
	    return;
	}
	var args = {
	    "clusters" : clusters,
	    "ranges"   : ranges,
	    "routes"   : routes
	};
	if (window.ISADMIN && _.size(ranges)) {
	    $('#override-checkbox').removeClass("hidden");

	    if ($('#admin-override').is(":checked")) {
		args["override"] = 1;
	    }
	}
	// Clear (hide) previous cluster table errors
	$('#reserve-request-form .form-group-sm').addClass("hidden");
	$('#reserve-request-form tbody').removeClass("has-warning has-error");

	aptforms.SubmitForm('#reserve-request-form', "resgroup",
			    "Reserve", reserve_callback,
			    "Submitting your reservation request; "+
			    "patience please", args);
    }

    function PopulateReservation()
    {
	var callback = function(json) {
	    console.log("PopulateReservation", json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // Messy.
	    var details = json.value;
	    $('#reserve-request-form [name=uuid]').val(details.uuid);
	    $('#reserve-request-form [name=reason]').val(details.notes);
	    var start = moment(details.start);
	    var end = moment(details.end);	
	    $('#reserve-request-form [name=start_day]')
		.val(start.format("MM/DD/YYYY"));
	    $('#reserve-request-form [name=start_hour]')
		.val(start.format("H"));
	    $('#reserve-request-form [name=end_day]')
		.val(end.format("MM/DD/YYYY"));
	    $('#reserve-request-form [name=end_hour]')
		.val(end.format("H"));
	    var hours = end.diff(start, "hours");
	    var days  = hours / 24;
	    $('#reserve-request-form [name=days]')
		.val(days.toFixed(1));

	    // Add cluster rows as needed.
	    if (_.size(details.clusters)) {
		_.each(details.clusters, function (res) {
		    var html = clusterRowTemplate({
			"cluster"     : res.cluster_id,
			"cluster_urn" : res.cluster_urn,
			"type"        : res.type,
			"count"       : res.count,
			"using"       : res.using != null ? res.using : "",
			"remote_uuid" : res.remote_uuid,
			"active"      : details.active,
			"approved"    : res.approved,
		    });
		    var row = $(html);
		    // Handler for changing node count.
		    row.find(".node-count").change(function () {
			HandleCountChange(row);
		    });
		    // Handler for delete row.
		    row.find(".delete-reservation").click(function () {
			Delete(row);
		    });
		    // This activates the tooltip subsystem.
		    row.find('[data-toggle="tooltip"]').tooltip({
			placement: 'auto'
		    });
		    $('#cluster-table').append(row);
		});
		UpdateClustersTable(details);
		$('#cluster-table .add-cluster').click(function (event) {
		    AddClusterRow();
		});
		$('#cluster-table .add-cluster').last().removeClass("hidden");
	    }
	    else {
		// Always show an empty cluster row.
		AddClusterRow();
	    }

	    // Add range rows as needed.
	    if (_.size(details.ranges)) {
		_.each(details.ranges, function (res) {
		    var html = frequencyRowTemplate({
			"freq_low"    : res.freq_low,
			"freq_high"   : res.freq_high,
			"freq_uuid"   : res.freq_uuid,
			"active"      : details.active,
			"approved"    : res.approved,
		    });
		    var row = $(html);
		    // Handler for delete row.
		    row.find(".delete-range").click(function () {
			Delete(row);
		    });
		    // This activates the tooltip subsystem.
		    row.find('[data-toggle="tooltip"]').tooltip({
			placement: 'auto'
		    });
		    $('#range-table').append(row);
		});
		UpdateRangeTable(details);
		$('#range-table .add-range').click(function (event) {
		    AddRangeRow();
		});
		$('#range-table .add-range').last().removeClass("hidden");
		if (window.ISADMIN) {
		    $('#override-checkbox').removeClass("hidden");
		}
	    }
	    else {
		// Always show an empty range row.
		if (window.ISPOWDER) {
		    AddRangeRow();
		}
	    }

	    // Add route rows as needed.
	    if (_.size(details.routes)) {
		_.each(details.routes, function (res) {
		    var html = routeRowTemplate({
			"routename"   : res.routename,
			"route_uuid"  : res.route_uuid,
			"active"      : details.active,
			"approved"    : res.approved,
		    });
		    var row = $(html);
		    // Handler for delete row.
		    row.find(".delete-route").click(function () {
			Delete(row);
		    });
		    // This activates the tooltip subsystem.
		    row.find('[data-toggle="tooltip"]').tooltip({
			placement: 'auto'
		    });
		    $('#route-table').append(row);
		});
		UpdateRouteTable(details);
		$('#route-table .add-route').click(function (event) {
		    AddRouteRow();
		});
		$('#route-table .add-route').last().removeClass("hidden");
	    }
	    else {
		// Always show an empty route row.
		if (window.ISPOWDER && isadmin) {
		    AddRouteRow();
		}
	    }

	    /*
	     * Need this in case the start date is in the past.
	     */
	    $("#reserve-request-form #start_day")
		.datepicker("option", "minDate", start.format("MM/DD/YYYY"));

	    // Set the hour selectors properly in the datepicker object.
	    $("#reserve-request-form #start_day")
		.datepicker("setDate", start.format("MM/DD/YYYY"));
	    $("#reserve-request-form #end_day")
		.datepicker("setDate", end.format("MM/DD/YYYY"));

	    // Local user gets a link.
	    if (_.has(details, 'uid_idx')) {
		$('#reserve-requestor').html(
		    "<a target=_blank href='user-dashboard.php?user=" +
			details.uid_idx + "'>" +
			details.uid + "</a>");
	    }
	    else {
		$('#reserve-requestor').html(details.uid);
	    }
	    // Ditto the project.
	    if (_.has(details, 'pid_idx')) {
		$('#pid').html(
		    "<a target=_blank href='show-project.php?project=" +
			details.pid_idx + "'>" +
			details.pid + "</a>");
	    }
	    else {
		$('#pid').html(details.pid);
	    }
	    
	    if (isadmin) {
		/*
		 * If this is an admin looking at an unapproved reservation,
		 * show the approve button
		 */
		if (!details.approved) {
		    $('#reserve-approve-button')
			.removeClass("hidden")
			.removeAttr("disabled")
			.click(function(event) {
			    event.preventDefault();
			    Approve();
			});
		}
		else {
		    if (details.idledetection) {
			$('#idle-detection-checkbox').prop("checked", true);
		    }
		    else {
			$('#idle-detection-checkbox').prop("checked", false);
		    }
		    $('#idle-detection-checkbox-div').removeClass("hidden");
		}
		
		var now   = new Date();
		var start = new Date(details.start);

		if (now.getTime() > start.getTime()) {
		    // A (partially) approved reservation also needs the
		    // the warn button, if its start time has passed.
		    if (details.active ||
			details.canceled != _.size(details.reservations)) {
			$('#reserve-warn-button').removeClass("hidden");
		    }
		    // A (partially) canceled reservation also needs the
		    // the uncancel button.
		    if (details.canceled) {
			$('#reserve-uncancel-button').removeClass("hidden");
		    }
		}
	    }
	    
	    // Need this in Delete().
	    window.PID = details.pid;
	    // Now enable delete button
	    $('#reserve-delete-button').removeAttr("disabled");
	    // Now enable refresh button
	    $('#reserve-refresh-button').removeAttr("disabled");

	    // Now we can load the graph since we know the project.
	    LoadReservations(details.pid);
	};
	sup.CallServerMethod(null, "resgroup",
			     "GetReservationGroup",
			     {"uuid"    : window.UUID},
			     callback);
    }

    /*
     * Update just the clusters table from current info, say after a refresh.
     */
    function UpdateClustersTable(details, operationResults)
    {
	var reservations = details.clusters;
	console.info("UpdateClustersTable", details, operationResults);

	/*
	 * Look for any reservations that are gone (deleted) from the group
	 */
	$('#cluster-table tbody.existing-cluster').each(function () {
	    var tbody = $(this);
	    var uuid  = tbody.attr('data-uuid');

	    if (!_.has(reservations, uuid)) {
		console.info("reservation is gone: " + uuid);
		tbody.remove();
	    }
	});
	
	_.each(reservations, function (res) {
	    var uuid  = res.remote_uuid;
	    var tbody = $('#cluster-table tbody[data-uuid="' + uuid + '"]');
	    var newClass = "";

	    // Update the hidden using count.
	    if (details.active && res.using != null) {
		tbody.find(".underused-warning .using-count").val(res.using);
	    }

	    if (operationResults &&
		_.has(operationResults, uuid) &&
		operationResults[uuid].errcode) {
		tbody.find(".reservation-error span label")
		    .html(operationResults[uuid].errmesg);
		newClass = "has-error";
	    }
	    else if (!res.approved) {
		tbody.find(".reservation-error span label")
		    .html("The reservation above has not been approved yet");
		newClass = "has-warning";
	    }
	    else if (!res.approved_pushed) {
		tbody.find(".reservation-error span label")
		    .html("The reservation above is approved but the cluster " +
			  "is not reachable");
		newClass = "has-warning";
	    }
	    else if (res.canceled) {
		var when = moment(res.canceled).format("lll");
		tbody.find(".reservation-error span label")
  		   .html("The reservation above is scheduled to be canceled " +
		         "at " + when +
			 (!res.canceled_pushed ?
			  " but the cluster is not reachable" : ""));
		newClass = "has-error";
	    }
	    else if (res.cancel_canceled) {
		tbody.find(".reservation-error span label")
		    .html("The reservation above has been un-canceled" +
			  " but the cluster is not reachable");
		newClass = "has-error";
	    }
	    else if (res.deleted) {
		tbody.find(".reservation-error span label")
		    .html("The reservation above has been deleted" +
			  (!res.deleted_pushed ?
			   " but the cluster is not reachable" : ""));
		newClass = "has-error";
	    }
	    if (newClass == "") {
		tbody.find(".reservation-error span")
		    .addClass("hidden");
		tbody.removeClass("has-warning has-error");
	    }
	    else {
		tbody.find(".reservation-error span")
		    .removeClass("has-warning has-error")
		    .addClass(newClass)
		    .removeClass("hidden");
		tbody.removeClass("has-warning has-error")
		    .addClass(newClass);
	    }
	    // Watch for underused.
	    if (details.active && res.approved && details.using != null && 
		res.using < res.count) {
		tbody.find(".underused-warning span")
		    .removeClass("hidden");
		if (newClass == "") {
		    tbody.removeClass("has-warning has-error")
			.addClass("has-warning");
		}
	    }
	    else {
		tbody.find(".underused-warning span")
		    .addClass("hidden");
	    }
	});
	if (details.approved) {
	    $('#unapproved-warning').addClass("hidden");
	    if (isadmin) {
		$('#reserve-approve-button').addClass("hidden");
	    }
	}
	else {
	    $('#unapproved-warning').removeClass("hidden");
	}
	// Only one reservation left, kill the delete buttons.
	if ($('#cluster-table tbody.existing-cluster').length == 1) {
	    $('#cluster-table .delete-reservation').addClass("hidden");
	}
	else {
	    $('#cluster-table .delete-reservation').removeClass("hidden");
	}
	// If no new reservations have been added, need to display
	// add button on last existing reservation.
	if ($('#cluster-table tbody.new-cluster').length == 0) {
	    $('#cluster-table tbody.existing-cluster .add-cluster')
		.addClass("hidden");
	    $('#cluster-table tbody.existing-cluster .add-cluster')
		.last().removeClass("hidden");
	}
	// Add append history graphs under the reservation panel
	DrawHistoryGraphs(details);
    }

    /*
     * Update just the range table from current info, say after a refresh.
     */
    function UpdateRangeTable(details, operationResults)
    {
	var reservations = details.ranges;
	console.info("UpdateRangeTable", details, operationResults);

	/*
	 * Look for any reservations that are gone (deleted) from the group
	 */
	$('#range-table tbody.existing-range').each(function () {
	    var tbody = $(this);
	    var uuid  = tbody.attr('data-uuid');

	    if (!_.has(reservations, uuid)) {
		console.info("reservation is gone: " + uuid);
		// Kill tooltips since they get left behind if visible.
		tbody.find('[data-toggle="tooltip"]').tooltip('destroy');
		tbody.remove();
	    }
	});
	
	_.each(reservations, function (res) {
	    var uuid  = res.freq_uuid;
	    var tbody = $('#range-table tbody[data-uuid="' + uuid + '"]');
	    var newClass = "";

	    if (operationResults &&
		_.has(operationResults, uuid) &&
		operationResults[uuid].errcode) {
		tbody.find(".reservation-error span label")
		    .html(operationResults[uuid].errmesg);
		newClass = "has-error";
	    }
	    else if (!res.approved) {
		tbody.find(".reservation-error span label")
		    .html("The reservation above has not been approved yet");
		newClass = "has-warning";
	    }
	    else if (res.canceled) {
		var when = moment(res.canceled).format("lll");
		tbody.find(".reservation-error span label")
  		   .html("The reservation above is scheduled to be canceled " +
		         "at " + when);
		newClass = "has-error";
	    }
	    if (newClass == "") {
		tbody.find(".reservation-error span")
		    .addClass("hidden");
		tbody.removeClass("has-warning has-error");
	    }
	    else {
		tbody.find(".reservation-error span")
		    .removeClass("has-warning has-error")
		    .addClass(newClass)
		    .removeClass("hidden");
		tbody.removeClass("has-warning has-error")
		    .addClass(newClass);
	    }
	});
	if (details.approved) {
	    if (isadmin) {
		$('#reserve-approve-button').addClass("hidden");
	    }
	}
	// Always display delete button on existing ranges,
	$('#range-table .existing-range .delete-range').removeClass("hidden");

	// If no new reservations have been added, need to display
	// add button on last existing reservation.
	if ($('#range-table tbody.new-range').length == 0) {
	    $('#range-table tbody.existing-range .add-range')
		.addClass("hidden");
	    $('#range-table tbody.existing-range .add-range')
		.last().removeClass("hidden");
	}
    }

    /*
     * Update just the route table from current info, say after a refresh.
     */
    function UpdateRouteTable(details, operationResults)
    {
	var reservations = details.routes;
	console.info("UpdateRouteTable", details, operationResults);

	/*
	 * Look for any reservations that are gone (deleted) from the group
	 */
	$('#route-table tbody.existing-range').each(function () {
	    var tbody = $(this);
	    var uuid  = tbody.attr('data-uuid');

	    if (!_.has(reservations, uuid)) {
		console.info("reservation is gone: " + uuid);
		// Kill tooltips since they get left behind if visible.
		tbody.find('[data-toggle="tooltip"]').tooltip('destroy');
		tbody.remove();
	    }
	});
	
	_.each(reservations, function (res) {
	    var uuid  = res.route_uuid;
	    var tbody = $('#route-table tbody[data-uuid="' + uuid + '"]');
	    var newClass = "";

	    if (operationResults &&
		_.has(operationResults, uuid) &&
		operationResults[uuid].errcode) {
		tbody.find(".reservation-error span label")
		    .html(operationResults[uuid].errmesg);
		newClass = "has-error";
	    }
	    else if (!res.approved) {
		tbody.find(".reservation-error span label")
		    .html("The reservation above has not been approved yet");
		newClass = "has-warning";
	    }
	    else if (res.canceled) {
		var when = moment(res.canceled).format("lll");
		tbody.find(".reservation-error span label")
  		   .html("The reservation above is scheduled to be canceled " +
		         "at " + when);
		newClass = "has-error";
	    }
	    if (newClass == "") {
		tbody.find(".reservation-error span")
		    .addClass("hidden");
		tbody.removeClass("has-warning has-error");
	    }
	    else {
		tbody.find(".reservation-error span")
		    .removeClass("has-warning has-error")
		    .addClass(newClass)
		    .removeClass("hidden");
		tbody.removeClass("has-warning has-error")
		    .addClass(newClass);
	    }
	});
	if (details.approved) {
	    if (isadmin) {
		$('#reserve-approve-button').addClass("hidden");
	    }
	}
	// Always display delete button on existing routes
	$('#route-table .existing-route .delete-route').removeClass("hidden");

	// If no new reservations have been added, need to display
	// add button on last existing reservation.
	if ($('#route-table tbody.new-route').length == 0) {
	    $('#route-table tbody.existing-route .add-route')
		.addClass("hidden");
	    $('#route-table tbody.existing-route .add-route')
		.last().removeClass("hidden");
	}
    }

    /*
     * Call above function after getting updated reservation details,
     * displaying any errors we need to after an operation.
     */
    function RefreshTables(operationResults)
    {
	console.info("RefreshTables", operationResults);
	
	sup.CallServerMethod(null, "resgroup",
			     "GetReservationGroup",
			     {"uuid"    : window.UUID},
			     function(json) {
				 console.info(json);
				 if (json.code) {
				     sup.SpitOops("oops", json.value);
				     return;
				 }
				 UpdateClustersTable(json.value,
						     operationResults);
				 UpdateRangeTable(json.value,
						  operationResults);
				 UpdateRouteTable(json.value,
						  operationResults);
			     });
    }

    /*
     * Refresh the reservations from the clusters.
     */
    function Refresh()
    {
	var callback = function(json) {
	    console.info(json);
	    sup.HideWaitWait();
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    RefreshTables(json.value);
	};
	var args = {"uuid" : window.UUID};
	sup.ShowWaitWait();
	var xmlthing = sup.CallServerMethod(null, "resgroup",
					    "Refresh", args);
	xmlthing.done(callback);
    }

    /*
     * Delete a reservation. Might be a group, or a single row in a group
     */
    function Delete(row)
    {
	console.info("Delete", row);
	
	var callback = function(json) {
	    sup.HideWaitWait();
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // We get this when the reservation group is really gone,
	    // no errors trying to delete one or more.
	    if (_.has(json.value, "redirect")) {
		window.location.replace(json.value.redirect);
		return;
	    }
	    RefreshTables(json.value);
	};

	var args = {"uuid" : window.UUID};
	if (row !== undefined) {
	    args["reservation_uuid"] = $(row).attr('data-uuid');
	}
	console.info("Delete", args);
	
	// Bind the confirm button in the modal. Do the deletion.
	$('#delete-reservation-modal #confirm-delete').click(function (e) {
	    e.preventDefault();
	    sup.HideModal('#delete-reservation-modal', function () {
		args["reason"] = $('#delete-reason').val();
		sup.ShowWaitWait();
		var xmlthing = sup.CallServerMethod(null, "resgroup",
						    "Delete", args);
		xmlthing.done(callback);
	    });
	});
	
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$('#delete-reservation-modal').on('hidden.bs.modal', function (e) {
	    $('#delete-reservation-modal #confirm-delete').unbind("click");
	    $('#delete-reservation-modal').off('hidden.bs.modal');
	})
	sup.ShowModal("#delete-reservation-modal");
    }

    /*
     * Approve a reservation
     */
    function Approve()
    {
	var callback = function (json) {
	    console.info(json);
	    sup.HideModal('#waitwait-modal');
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    $('#override-checkbox').prop("checked", false);	    
	    RefreshTables(json.value);
	    LoadRangeReservations();
	    if (isadmin) {
		LoadRouteReservations();
	    }
	};
	var args = {
	    "uuid"    : window.UUID,
	};
	if ($('#admin-override').is(":checked")) {
	    args["override"] = 1;
	}
	// Bind the confirm button in the modal. Do the approval.
	$('#approve-modal #confirm-approve').click(function () {
	    sup.HideModal('#approve-modal', function () {
		var message = $('#approve-modal .user-message').val().trim();
		args["message"] = message;
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "resgroup",
						    "Approve", args);
		xmlthing.done(callback);
	    });
	});
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$('#approve-modal').on('hidden.bs.modal', function (e) {
	    $('#approve-modal #confirm-approve').unbind("click");
	    $('#approve-modal').off('hidden.bs.modal');
	})
	sup.ShowModal("#approve-modal");
    }

    /*
     * Ask for info about reservation (usage, lack of usage, etc).
     * Optional cancel.
     */
    function InfoOrWarning(which) {
	var warning = (which == "warn" ? 1 : 0);
	var modal   = (warning ? "#warn-modal" : "#info-modal");
	var method  = (warning ? "WarnUser" : "RequestInfo");
	var cancel  = 0;

	var callback = function (json) {
	    console.log(method, json);
	    if (json.code) {
		if (!warning) {
		    sup.HideWaitWait(function () {
			sup.SpitOops("oops", json.value);
		    });
		}
		else {
		    sup.SpitOops("oops", json.value);
		}
		return;
	    }
	    if (!warning) {
		sup.HideWaitWait();
	    }
	    if (cancel) {
		RefreshTables(json.value);
	    }
	};
	// Bind the confirm button in the modal. 
	$(modal + ' .confirm-button').click(function () {
	    var message = $(modal + ' .user-message').val();
	    if (!warning && message.trim().length == 0) {
		$(modal + ' .nomessage-error').removeClass("hidden");
		return;
	    }
	    if (warning && $('#schedule-cancellation').is(":checked")) {
		cancel = 1;
	    }
	    var args = {"uuid"    : window.UUID,
			"cancel"  : cancel,
			"message" : message};
	    console.info("warninfo", args);
	    
	    sup.HideModal(modal, function () {
		if (!warning) {
		    // This will take a few moments.
		    sup.ShowWaitWait();
		}
		var xmlthing = sup.CallServerMethod(null, "resgroup",
						    method, args);
		xmlthing.done(callback);
	    });
	});
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$(modal).on('hidden.bs.modal', function (e) {
	    $(modal + ' .confirm-button').unbind("click");
	    $(modal).off('hidden.bs.modal');
	})
	// Hide error
	if (!warning) {
	    $(modal + ' .nomessage-error').addClass("hidden");
	}
	sup.ShowModal(modal);
    }

    /*
     * Cancel a cancellation.
     */
    function Uncancel()
    {
	var callback = function (json) {
	    console.info(json);
	    sup.HideModal('#waitwait-modal');
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    RefreshTables(json.value);
	};
	// Bind the confirm button in the modal. 
	$('#uncancel-modal #confirm-uncancel').click(function () {
	    sup.HideModal('#uncancel-modal', function () {
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "resgroup",
						    "Cancel",
						    {"uuid"    : window.UUID,
						     "clear"   : 1});
		xmlthing.done(callback);
	    });
	});
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$('#uncancel-modal').on('hidden.bs.modal', function (e) {
	    $('#uncancel-modal #confirm-uncancel').unbind("click");
	    $('#uncancel-modal').off('hidden.bs.modal');
	})
	sup.ShowModal("#uncancel-modal");
    }

    /*
     * Toggle idle detection whenever the checkbox is flipped.
     */
    function ToggleIdleDetection()
    {
	var value = ($('#idle-detection-checkbox').is(":checked") ? 1 : 0);
	
	sup.ShowModal('#waitwait-modal');
	sup.CallServerMethod(null, "resgroup", "IdleDetection",
			     {"uuid"    : window.UUID,
			      "value"   : value},
			     function (json) {
				 console.info(json);
				 if (json.code == 0) {
				     sup.HideModal('#waitwait-modal');
				     return;
				 }
				 sup.HideModal('#waitwait-modal', function () {
				     sup.SpitOops("oops", "Cannot toggle idle" +
						  " detection: " + json.value);
				 });
				 // Flip the checkbox back.
				 $('#idle-detection-checkbox')
				     .prop("checked", value ? false : true);
			     });
    }

    function HandleClusterChange(row, selected_cluster)
    {
	/*
	 * Build up selection list of types on the selected cluster
	 */
	var options  = "";
	var typelist = amlist[selected_cluster].typeinfo;
	var nodelist = amlist[selected_cluster].reservable_nodes;
	var nickname = amlist[selected_cluster].nickname;
	var id       = "resgraph-" + nickname;

	_.each(typelist, function(details, type) {
	    var count = details.count;
	    
	    options = options +
		"<option value='" + type + "' >" +
		type + " (" + count + ")</option>";
	});
	_.each(nodelist, function(details, node_id) {
	    options = options +
		"<option value='" + node_id + "' >" + node_id + "</option>";
	});
	
	row.find(".hardware-select")	
	    .html("<option value=''>Select Hardware</option>" + options);

	if ($('#reservation-lists :first-child').attr("id") != id) {
	    $('#' + id).fadeOut("fast", function () {
		$('#reservation-lists').prepend($('#' + id));
		$('#' + id).fadeIn("fast");
	    });
	}
	modified_callback();
    }

    function HandleTypeChange(row)
    {
	var thisuuid = $(row).attr('data-uuid');
	var selected_cluster =
	    $(row).find(".cluster-select option:selected").val();
	var selected_type =
	    $(row).find(".hardware-select option:selected").val();

	console.info(thisuuid, selected_cluster, selected_type);
	if (selected_cluster == "") {
	    return;
	}
	if (selected_type == "") {
	    return;
	}
	// Do not allow two rows with the same cluster/type.
	var clusters = Object.values(GetClusterRows());
	for (var cluster of clusters) {
	    if (cluster.uuid != thisuuid &&
		cluster.cluster == selected_cluster &&
		cluster.type == selected_type) {
		$(row).find(".hardware-select")
		    .prop("selectedIndex", 0);
		alert("Not allowed to have two rows with the " +
		      "same cluster and type");
		return;
	    }
	}
	var nodelist = amlist[selected_cluster].reservable_nodes;
	if (nodelist) {
	    console.info("nodelist", nodelist);
	}

	if (nodelist && _.has(nodelist, selected_type)) {
	    $(row).find(".node-count")
		.val("1")
		.prop("readonly", true);
	}
	else {
	    $(row).find(".node-count")
		.val("")
		.prop("readonly", false);
	}
	RegenCombinedGraph();
	modified_callback();
    }

    function HandleCountChange(row)
    {
	var tbody    = $(row);
	var thisuuid = $(row).attr('data-uuid');
	var count    = $(row).find(".node-count").val();
	var cluster;
	var type;

	if (tbody.hasClass("new-cluster")) {
	    cluster = tbody.find(".cluster-select option:selected").val();
	    type    = tbody.find(".hardware-select option:selected").val();
	}
	else {
	    cluster = tbody.find(".cluster-selected").attr("data-urn");
	    type    = $.trim(tbody.find(".hardware-selected").text());
	}
	console.info("HandleCountChange", thisuuid, cluster, type, count);
	if (cluster == "" || type == "" || count == "" || !isNumber(count)) {
	    return;
	}
	modified_callback();
	if (_.has(amlist[cluster].typeinfo, type)) {
	    var max = amlist[cluster].typeinfo[type].count;
	    if (max) {
		max = parseInt(max);
		if (count > max) {
		    alert("There are only " + max + " node(s) of this type");
		    $(row).find(".node-count").val("")
		    return;
		}
	    }
	}
    }

    // Toggle the button between check and submit.
    function ToggleSubmit(enable, which) {
	if (which == "submit") {
	    $('#reserve-submit-button').text("Submit");
	    $('#reserve-submit-button').addClass("btn-success");
	    $('#reserve-submit-button').removeClass("btn-primary");
	}
	else if (which == "check") {
	    $('#reserve-submit-button').text("Check");
	    $('#reserve-submit-button').removeClass("btn-success");
	    $('#reserve-submit-button').addClass("btn-primary");
	}
	if (enable) {
	    $('#reserve-submit-button').removeAttr("disabled");
	}
	else {
	    $('#reserve-submit-button').attr("disabled", "disabled");
	}
	buttonstate = which;
    }

    // Draw the history bar graph.
    function DrawHistoryGraphs(details)
    {
	$("#history-graphs").html("");

	if (!details.active) {
	    return;
	}
	_.each(details.clusters, function (res) {
	    if (!_.has(res, "jsondata") || res.jsondata == null) {
		return;
	    }
	    var json = JSON.parse(res.jsondata);
	    console.info("DrawHistoryGraphs", json);
	    
	    var uuid     = res.remote_uuid;
	    var graphid  = "resgraph-" + uuid;
	    var nickname = res.cluster_id;
	    var title    = "Reservation Usage for " + nickname + "/" + res.type;
	    var html     = usageTemplate({"graphid"        : graphid,
					  "showfullscreen" : false});
	    $('#history-graphs').append(html);
	    $('#' + graphid + ' .graph-title').html(title);

	    if (!_.size(json.history)) {
		$('#' + graphid + ' .resgraph')
		    .html("<span class=text-danger>There is no usage info " +
			  "for this reservation, are you using it?");
		return;
	    }

	    // Need a little fix up here, resgraphs is expecting various
	    // things in the res object.
	    res["remote_pid"] = json.remote_pid;
	    res["remote_uid"] = json.remote_uid;
	    res["history"]    = json.history;
	    res["start"]      = details.start;
	    res["end"]        = details.end;
	    res["nodes"]      = res.count;
	    
	    window.DrawResHistoryGraph({"details"  : res,
					"graphid"  : '#' + graphid});
	});
    }

    /*
     * Update the combined graph as the user selects and deselects types.
     */
    function RegenCombinedGraph()
    {
	var clusters = GetClusterRows();
	var routes   = GetRouteRows();
	var combinedForecasts = {};
	var waiting = 0;
	console.info("RegenCombinedGraph", clusters);

	_.each(clusters, function (details) {
	    var urn  = details.cluster;
	    var type = details.type;

	    if (!_.has(amlist, urn)) {
		return;
	    }
	    if (!_.has(forecasts[urn], type)) {
		waiting = waiting + 1;
		return;
	    }
	    var id   = amlist[urn].abbreviation + "/" + type;
	    
	    combinedForecasts[id] = forecasts[urn][type];
	})
	_.each(routes, function (details) {
	    var routename = details.routename;

	    if (_.has(routeforecast, routename)) {
		combinedForecasts[routename] = routeforecast[routename]
	    }
	})
	
	console.info("AddToCombinedGraph", combinedForecasts);

	// Must be visible before graph can be drawn.
	$("#combined-resgraph").removeClass("hidden");

	if (waiting) {
	    // Do not draw anything until later.
	    $("#combined-resgraph .resgraph-spinner").removeClass("hidden");
	    return;
	}
	$("#combined-resgraph .resgraph-spinner").addClass("hidden");
	
	ShowResGraph({"forecast"       : combinedForecasts,
		      "selector"       : "combined-resgraph",
		      "skiptypes"      : {},
		      "colors"         : RouteColors,
		      "click_callback" : function(when, type) {
			  if (!editing) {
			      var start = moment(when);
			      $('#reserve-request-form [name=start_day]')
				  .val(start.format("MM/DD/YYYY"));
			      $('#reserve-request-form [name=start_hour]')
				  .val(start.format("H"));
			  }
		      },
		     });
    }

    function RegenFEGraph()
    {
	$('#FE-graph-div').removeClass("hidden");
	$('#FE-graph-visavail').html("");

	var dataset = [];
	var now     = new Date();
	var maxend  = now;

	Object.keys(FEs)
	    .sort()
	    .forEach(function(urn, index) {
		// Do we have the forecasts yet?
		if (!_.has(forecasts, urn)) {
		    return;
		}
		var details = FEs[urn];

		Object.keys(forecasts[urn])
		    .sort()
		    .forEach(function(type, index) {
			var forecast = forecasts[urn][type];
			var id = amlist[urn].abbreviation + " " + type;

			var series = {
			    "measure"   : id,
			    "interval_s": 3600,
			    "data"      : [],
			    "categories": {
				"Busy": { "color": "black" },
				"Free": { "color": "green"},
			    },
			};
			for (var i = 0; i < forecast.length; i++) {
			    var info  = forecast[i];
			    var start = moment(info.stamp).toDate();
			    var state = info.free ? "Free" : "Busy";
			    var end;

			    if (i < forecast.length - 1) {
				end = moment(forecast[i + 1].stamp).toDate();
			    }
			    else {
				end = new Date(start.getTime());
				end.setMonth(end.getMonth()+2);
			    }
			    // Upper bound on the end of the last entry, so
			    // we can even things out on the very right
			    // side.
			    if (end > maxend) {
				maxend = end;
			    }
			    series.data.push([start, state, end]);
			}
			dataset.push(series);
		    });
	    });
	ShowNewGraph(dataset, maxend, "FE-graph-body", "FE-graph-visavail")
    }

    function GenerateRouteGraph()
    {
	$('#route-graph-div').removeClass("hidden");
	
	var dataset = [];
	var now     = new Date();
	var maxend  = now;

	Object.keys(routeforecast)
	    .sort()
	    .forEach(function(route, index) {
		var forecast = routeforecast[route];
		var series = {
		    "measure"   : route,
		    "interval_s": 3600,
		    "data"      : [],
		    "categories": {
			"Busy": { "color": "black" },
			"Free": { "color": "green" },
		    },
		};
		for (var i = 0; i < forecast.length; i++) {
		    var info  = forecast[i];
		    var start = moment(info.stamp).toDate();
		    var state = info.free ? "Free" : "Busy";
		    var end;

		    if (i < forecast.length - 1) {
			end = moment(forecast[i + 1].stamp).toDate();
		    }
		    else {
			end = new Date(start.getTime());
			end.setMonth(end.getMonth()+2);
		    }
		    // Upper bound on the end of the last entry, so we can
		    // even things out on the very right side.
		    if (end > maxend) {
			maxend = end;
		    }
		    series.data.push([start, state, end]);
		}
		dataset.push(series);
	    });
	ShowNewGraph(dataset, maxend,
		     "route-graph-body", "route-graph-visavail");
    }

    function GenerateRadioGraph()
    {
	$('#radio-graph-div').removeClass("hidden");
	
	var dataset = [];
	var now     = new Date();
	var maxend  = now;

	Object.keys(Radios)
	    .sort()
	    .forEach(function(node_id, index) {
		var forecast = Radios[node_id];
		var series = {
		    "measure"   : node_id,
		    "interval_s": 3600,
		    "data"      : [],
		    "categories": {
			"Busy": { "color": "black" },
			"Free": { "color": "green"},
		    },
		};
		for (var i = 0; i < forecast.length; i++) {
		    var info  = forecast[i];
		    var start = moment(info.stamp).toDate();
		    var state = info.free ? "Free" : "Busy";
		    var end;

		    if (i < forecast.length - 1) {
			end = moment(forecast[i + 1].stamp).toDate();
		    }
		    else {
			end = new Date(start.getTime());
			end.setMonth(end.getMonth()+2);
		    }
		    // Upper bound on the end of the last entry, so we can
		    // even things out on the very right side.
		    if (end > maxend) {
			maxend = end;
		    }
		    series.data.push([start, state, end]);
		}
		dataset.push(series);
	    });
	ShowNewGraph(dataset, maxend,
		     "radio-graph-body", "radio-graph-visavail");
    }

    /*
     * Generate a new style graph in the provide container.
     */
    function ShowNewGraph(dataset, maxend, container, graph)
    {
	// Even out the right side.
	_.each(dataset, function(series) {
	    var last = series.data[series.data.length - 1];
	    var end  = last[2];
	    if (maxend > end) {
		if (!last.free) {
		    last[2] = maxend;
		}
	    }
	});
	console.info("ShowNewGraph", dataset);
	
	var options = {
	    id_div_container: container,
	    id_div_graph: graph,
	    moment_locale: null,
	    line_spacing: 12,
	    custom_categories: true,
	    
	    responsive: {
		enabled: true,
	    },
	    icon: {
		class_has_data: 'fas fa-fw fa-check',
		class_has_no_data: 'fas fa-fw fa-exclamation-circle'
	    },
	    margin: {
		// top margin includes title and legend
		top: 25,
		// right margin should provide space for last horz. axis title
		right: 20,
		bottom: 10,
		// left margin should provide space for y axis titles
		left: 110,
	    },
	    padding:{
		// Match left margin above. Not sure why.
		left: -110
	    },
	    graph:{
		height:12,
	    },
	    tooltip: {
		enabled: true,
		date_plus_time: true,
	    },
	    zoom: {
		enabled: true,
	    },
	    legend: {
		enabled: false,
	    },
	    title: {
		enabled: false,
	    },
	    sub_title: {
		enabled: false,
	    },
	};
	var chart = visavail.generate(options, dataset)
    }

    /*
     * Populate a new reservation from an rspec.
     */
    function PopulateFromRspec()
    {
	var rspec     = $('#rspec textarea').val();	
	var EMULAB_NS = "http://www.protogeni.net/resources/rspec/ext/emulab/1";
	var xmlDoc    = $.parseXML(rspec);
	var spectrum  = xmlDoc.getElementsByTagNameNS(EMULAB_NS, 'spectrum');
	var routes    = xmlDoc.getElementsByTagNameNS(EMULAB_NS, 'busroutes');
	var tcounts   = {"_unbounded" : 0};
	console.info("PopulateFromRspec", spectrum, routes);

	_.each(spectrum, function(range) {
	    var freq_low  = $(range).attr("frequency_low");
	    var freq_high = $(range).attr("frequency_high");
	    console.info(freq_low,freq_high);

	    AddRangeRow(freq_low, freq_high);
	});
	_.each(routes, function(route) {
	    var routename  = $(route).attr("routename");
	    console.info(routename);

	    AddRouteRow(routename);
	});

	// Find all the nodes, gather up type info.
	$(xmlDoc).find("node").each(function() {
	    var htype        = $(this).find("hardware_type");
	    var component_id = $(this).attr("component_id");
	    var manager_id   = $(this).attr("component_manager_id");

	    console.info("ids", component_id, manager_id);

	    // Reservable nodes are easy.
	    if (component_id && manager_id &&
		_.has(amlist, manager_id) &&
		_.has(amlist[manager_id].reservable_nodes, component_id)) {
		var row = AddClusterRow();

		console.info("row", row);

		row.find(".cluster-select").val(manager_id).change();
		row.find(".hardware-select").val(component_id).change();
		return;
	    }
	    // Otherwise, we dig inside and find the hardware type.
	    // We want to count up how many of each type, and how many
	    // are unbounded.
	    if (!htype.length) {
		tcounts["_unbounded"]++;
		return;
	    }
	    var type = $(htype).attr("name");
	    if (!_.has(tcounts, type)) {
		tcounts[type] = 0;
	    }
	    tcounts[type]++;
	});
	_.each(tcounts, function (count, type) {
	    // Find the cluster that has this type.
	    _.each(amlist, function (details, urn) {
		if (_.has(details.typeinfo, type)) {
		    var row = AddClusterRow();

		    row.find(".cluster-select").val(urn).change();
		    row.find(".hardware-select").val(type).change();
		    row.find(".node-count").val(count).change();
		    return;
		}
	    });
	});
	console.info("tcounts", tcounts);
    }

    function isNumber(value) {
	if (isNaN(value)) {
	    return false;
	}
	var x = parseFloat(value);
	return isNaN(x) ? false : true;
    }
    $(document).ready(initialize);
});




