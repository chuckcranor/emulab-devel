$(function ()
{
    'use strict';

    var template_list   = ["resgroup", "reserve-faq",
			   "reservation-graph", "oops-modal", "waitwait-modal",
			   "resusage-graph"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var mainTemplate    = _.template(templates["resgroup"]);
    var graphTemplate   = _.template(templates["reservation-graph"]);
    var usageTemplate   = _.template(templates["resusage-graph"]);
    var projlist     = null;
    var amlist       = null;
    var isadmin      = false;
    var editing      = false;
    var buttonstate  = "check";
    var forecasts    = {};
    var IDEAL_STARTHOUR = 7;	// 7am start time preferred.

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
 	'           <span class="glyphicon glyphicon-plus"></span>' +
	'        </button>' +
	'        <button type="button" ' +
	'                class="btn btn-xs btn-default delete-cluster hidden"' +
	'                style="">' +
 	'           <span class="glyphicon glyphicon-minus"></span>' +
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
 	'          <span class="glyphicon glyphicon-plus"></span>' +
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
	'            href="reserve.php?edit=1&uuid=<%- remote_uuid %>' +
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
	'    </tr>'; 
	'    <tr class="error-row">' +
	'      <td colspan=4 class="reservation-error">' +
	'         <span class="form-group-sm hidden has-error"> ' +
	'           <label class="control-label">Error</label>' +
	'         </span>' +
	'      </td>' +
	'    </tr>'; 
	'  </body>'; 
    
    var clusterRowTemplate  = _.template(clusterRowString);

    /*
     * Callback when something changes so that we can toggle the
     * button from Submit to Check.
     */
    function modified_callback()
    {
	ToggleSubmit(true, "check");
	aptforms.MarkFormUnsaved();
    }
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	isadmin  = window.ISADMIN;
	editing  = window.EDITING; 
	projlist = JSON.parse(_.unescape($('#projects-json')[0].textContent));
	amlist   = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
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
	    AddClusterRow();
	}
	
	// Graph list(s).
	html = "";
	_.each(amlist, function(details, urn) {
	    var graphid = 'resgraph-' + details.nickname;

	    html += graphTemplate({"details"        : details,
				   "graphid"        : graphid,
				   "title"          : details.nickname,
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
	modified_callback();
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
     * These are validation errors (not enough nodes, etc).
     */
    function GenerateValidationErrors(clusters)
    {
	var errors   = 0;
	var approved = 0;

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
		errors++;
	    }
	    else if (parseInt(reservation.approved) != 0) {
		tbody.find(".reservation-error span")
		    .addClass("hidden");
		approved++;
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
	return {"errors" : errors, "approved" : approved};
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
     
    //
    // Check form validity. This does not check whether the reservation
    // is valid.
    //
    function CheckForm()
    {
	var start    = null;
	var end      = null;
	var clusters = {};
	
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
		return;
	    }
	    // Set the number of days, so that user can then search if
	    // the start/end selected do not work.
	    var hours = end.diff(start, "hours");
	    var days  = hours / 24;
	    $('#reserve-request-form [name=days]')
		.val(days.toFixed(1));
	    
	    // Now check the actual reservation validity.
	    ValidateReservation(clusters);
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
	// Collect the cluster rows into an array.
	clusters = GetClusterRows();

	// Clear (hide) previous cluster table errors
	$('#reserve-request-form .form-group-sm').addClass("hidden");
	
	aptforms.CheckForm('#reserve-request-form', "resgroup",
			   "Validate", checkonly_callback,
			   {"clusters" : clusters});
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
	    aptforms.MarkFormUnsaved();
	}
    }
    // Set the cluster after clicking on a graph.
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
	    aptforms.MarkFormUnsaved();
	}
    }

    /*
     * Load anonymized reservations from each am in the list and
     * generate tables.
     */
    function LoadReservations(project)
    {
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

		ShowResGraph({"forecast"  : json.value.forecast,
			      "selector"  : id,
			      "skiptypes"      : json.value.prunelist,
			      "click_callback" : function(when, type) {
				  if (!editing) {
				      SetCluster(details.nickname, urn);
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
					  "skiptypes"      : skiptypes,
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
						"ReservationInfo", args);
	    xmlthing.done(callback);
	});
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
     * Try to find the first fit.
     */
    function FindFit()
    {
	var days   = $('#reserve-request-form [name=days]').val();
	var index = 0;

	// List of reservation requests.
	var clusters = _.values(GetClusterRows());

	if (! days) {
	    alert("Please provide the number of days");
	    return;
	}
	console.info("FindFit: ", days, clusters);

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
	    while (tmp.length && starttime == null) {
		var data = tmp.shift();

		if (data.free >= cluster.count &&
		    (lower == null || data.t >= lower)) {
		    starttime = data.t;
		    startdata = data;

		    for (var i = 0; i < tmp.length; i++) {
			var next = tmp[i];

			if (starttime + (3600 * 24 * days) + 3600 < next.t) {
			    // The next time stamp is beyond the days requested,
			    // so it fits.
			    enddata = next;
			    break;
			}
			if (next.free >= cluster.count) {
			    // The next time stamp still has enough nodes,
			    // keep checking.
			    continue;
			}
			// Otherwise, we no longer fit, need to start over.
			starttime = null;
			break;
		    }
		}
	    }
	    return {"starttime" : starttime,
		    "startdata" : startdata,
		    "endtime"   : (enddata ? enddata.t : null),
		    "enddata"   : enddata,
		   };
	};
	var fit = findfirst(clusters[0], null, null);
	console.info("firstfit", fit);
	for (index = 1; index < clusters.length; index++) {
	    var results = findfirst(clusters[index], fit["starttime"], null);
	    console.info("nextfit", results);
	    if (results["starttime"] > fit["starttime"]) {
		fit["starttime"] = results["starttime"];
	    }
	    if (results["endtime"] &&
		(!fit["endtime"] || results["endtime"] < fit["endtime"])) {
		fit["endtime"] = results["endtime"];
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
	    alter("Could not find a time that works!");
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
	    ToggleSubmit(true, "check");
	    aptforms.MarkFormUnsaved();
	}
    }

    //
    // Validate the reservation. 
    //
    function ValidateReservation(clusters)
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
	    var reservations = json.value.reservations;
	    console.info("ValidateReservation", reservations);
	    var results = GenerateValidationErrors(reservations);
	    console.info("results", results);

	    // User needs to fix things up.
	    if (results.errors) {
		return;
	    }
	    
	    // User can submit.
	    ToggleSubmit(true, "submit");
	    // Make sure we still warn about an unsaved form.
	    aptforms.MarkFormUnsaved();
	    if (results.approved != _.size(reservations)) {
		$('#confirm-reservation .needs-approval')
		    .removeClass("hidden");
	    }
	    else {
		$('#confirm-reservation .needs-approval')
		    .addClass("hidden");
	    }
	    sup.ShowModal('#confirm-reservation');
	};
	// Clear (hide) previous cluster table errors
	$('#reserve-request-form .form-group-sm').addClass("hidden");
	
	aptforms.SubmitForm('#reserve-request-form', "resgroup",
			    "Validate", callback,
			    "Checking to see if your request can be "+
			    "accommodated", {"clusters" : clusters});
    }

    /*
     * And do it.
     */
    function Reserve()
    {
	var clusters = {};
	
	var reserve_callback = function(json) {
	    console.info(json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    var results = GenerateValidationErrors(json.value.reservations);
	    if (results.errors) {
		/*
		 * Partial success. We want to stay here. But if not
		 * editing, we need to shift into edit mode. 
		 */
		if (!editing && _.has(json.value, "uuid")) {
		    editing = true;
		    window.UUID = json.value.uuid;
		}
		/*
		 * The ones that succeeded have a new UUID, it was replaced
		 * with the remote uuid of the reservation. Need to change
		 * the table so that an edit operation after error works
		 * correctly (maps to the remote_uuid stored in the DB).
		 */
		_.each(json.value.reservations, function (reservation, uuid) {
		    var tbody = $('#cluster-table tbody[data-uuid="' +
				  uuid + '"]');
		    if (uuid != reservation.uuid) {
			tbody.attr("data-uuid", reservation.uuid);
		    }
		});
		return;
	    }
	    window.location.replace("resgroup.php?edit=1" +
				    "&uuid=" + json.value.uuid);
	    return;
	};
	// Collect the cluster rows into an array.
	clusters = GetClusterRows();

	// Clear (hide) previous cluster table errors
	$('#reserve-request-form .form-group-sm').addClass("hidden");

	aptforms.SubmitForm('#reserve-request-form', "resgroup",
			    "Reserve", reserve_callback,
			    "Submitting your reservation request; "+
			    "patience please", {"clusters" : clusters});
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

	    // Add cluster/type/count rows as needed.
	    _.each(details.reservations, function (res) {
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
		    modified_callback();
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
		    $('#reserve-approve-button').removeClass("hidden");
		    $('#reserve-approve-button').click(function(event) {
			event.preventDefault();
			Approve();
		    });
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
	var reservations = details.reservations;
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
	    else if (res.canceled) {
		tbody.find(".reservation-error span label")
		    .html("This reservation above has been canceled");
		newClass = "has-error";
	    }
	    else if (res.deleted) {
		tbody.find(".reservation-error span label")
		    .html("This reservation above has been deleted");
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
	    if (details.active && res.approved && res.using < res.count) {
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
     * Call above function after getting updated reservation details,
     * displaying any errors we need to after an operation.
     */
    function RefreshClustersTable(operationResults)
    {
	console.info("RefreshClustersTable", operationResults);
	
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
	    RefreshClustersTable(json.value);
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
	    RefreshClustersTable(json.value);
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
	    RefreshClustersTable(json.value);
	};
	// Bind the confirm button in the modal. Do the approval.
	$('#approve-modal #confirm-approve').click(function () {
	    sup.HideModal('#approve-modal', function () {
		var message = $('#approve-modal .user-message').val().trim();
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "resgroup",
						    "Approve",
						    {"uuid"    : window.UUID,
						     "message" : message});
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
		RefreshClustersTable(json.value);
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
	    RefreshClustersTable(json.value);
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
	    if (editing) {
		$('#reserve-approve-button').attr("disabled", "disabled");
	    }
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
	$("history-graphs").html("");

	if (!details.active) {
	    return;
	}
	_.each(details.reservations, function (res) {
	    if (!_.has(res, "jsondata") || res.jsondata == null) {
		return;
	    }
	    var uuid     = res.remote_uuid;
	    var graphid  = "resgraph-" + uuid;
	    var nickname = res.cluster_id;
	    var title    = "Reservation Usage for " + nickname + "/" + res.type;
	    var html     = usageTemplate({"graphid"        : graphid,
					  "showfullscreen" : false});
	    $('#history-graphs').append(html);
	    $('#' + graphid + ' .graph-title').html(title);

	    var json = JSON.parse(res.jsondata);
	    console.info("DrawHistoryGraphs", json);

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
	var combinedForecasts = {};

	_.each(clusters, function (details) {
	    var urn  = details.cluster;
	    var type = details.type;
	    var id   = amlist[urn].abbreviation + "/" + type;
	    
	    combinedForecasts[id] = forecasts[urn][type];
	})
	console.info("AddToCombinedGraph", combinedForecasts);

	// Must be visible before graph can be drawn.
	$("#combined-resgraph").removeClass("hidden");
	
	ShowResGraph({"forecast"  : combinedForecasts,
		      "selector"  : "combined-resgraph",
		      "skiptypes" : {},
		     });
    }
    $(document).ready(initialize);
});




