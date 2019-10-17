$(function ()
{
    'use strict';

    var template_list   = ["resgroup", "reserve-faq", "range-list",
			   "reservation-graph", "oops-modal", "waitwait-modal",
			   "resusage-graph"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var mainTemplate    = _.template(templates["resgroup"]);
    var graphTemplate   = _.template(templates["reservation-graph"]);
    var usageTemplate   = _.template(templates["resusage-graph"]);
    var rangeTemplate   = _.template(templates["range-list"]);
    var projlist     = null;
    var amlist       = null;
    var isadmin      = false;
    var editing      = false;
    var buttonstate  = "check";
    var forecasts    = {};
    var allranges    = [];
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
	'         <span class="form-group-sm hidden has-error '+
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
	    AddClusterRow();
	    AddRangeRow();
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
    }

    /*
     * Add a new range row.
     */
    function AddRangeRow()
    {
	var html = addFrequencyRowTemplate({
	    "freq_low"    : "",
	    "freq_high"   : "",
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
		return;
	    }
	    // Set the number of days, so that user can then search if
	    // the start/end selected do not work.
	    var hours = end.diff(start, "hours");
	    var days  = hours / 24;
	    $('#reserve-request-form [name=days]')
		.val(days.toFixed(1));
	    
	    // Now check the actual reservation validity.
	    ValidateReservation(clusters, ranges);
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
	// Collect the cluster and range rows into an array.
	clusters = GetClusterRows();
	ranges   = GetRangeRows();

	// Clear (hide) previous cluster table errors
	$('#reserve-request-form .form-group-sm').addClass("hidden");	
	$('#reserve-request-form tbody').removeClass("has-warning has-error");
	
	aptforms.CheckForm('#reserve-request-form', "resgroup",
			   "Validate", checkonly_callback,
			   {"clusters" : clusters,
			    "ranges"   : ranges});
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
	LoadRangeReservations();
	
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
	console.info("FindFit: ", days, clusters, ranges);

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
	    console.info("tmp", tmp);
	    while (tmp.length && starttime == null) {
		var data = tmp.shift();

		console.info("baz", data);
		
		if (data.free >= cluster.count) {
		    starttime = data.t;
		    startdata = data;
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
			    starttime = lower;
			}
		    }
		    console.info("boop", data);
		    
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
    function ValidateReservation(clusters, ranges)
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
	    var cluster_results, range_results;
	    
	    if (_.has(results, "cluster_results")) {
		cluster_results = results.cluster_results;
		GenerateClusterValidationErrors(cluster_results.clusters);
	    }
	    if (_.has(results, "range_results")) {
		range_results = json.value.range_results;
		GenerateRangeValidationErrors(range_results.ranges);
	    }
	    // User needs to fix things up.
	    if ((cluster_results && cluster_results.errors) ||
		(range_results && range_results.errors)) {
		return;
	    }
	    
	    // User can submit.
	    ToggleSubmit(true, "submit");
	    // Make sure we still warn about an unsaved form.
	    aptforms.MarkFormUnsaved();

	    if ((cluster_results &&
		 cluster_results.approved != _.size(clusters)) ||
		(range_results &&
		 range_results.approved != _.size(ranges))) {
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
	$('#reserve-request-form tbody').removeClass("has-warning has-error");
	
	aptforms.SubmitForm('#reserve-request-form', "resgroup",
			    "Validate", callback,
			    "Checking to see if your request can be "+
			    "accommodated",
			    {"clusters" : clusters,
			     "ranges"   : ranges});
    }

    /*
     * And do it.
     */
    function Reserve()
    {
	var clusters = {};
	var ranges   = {};
	
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
	    var cluster_results, range_results;
	    
	    if (_.has(results, "cluster_results")) {
		cluster_results = results.cluster_results;
		GenerateClusterValidationErrors(cluster_results.clusters);
	    }
	    if (_.has(results, "range_results")) {
		range_results = json.value.range_results;
		GenerateRangeValidationErrors(range_results.ranges);
	    }
	    // User needs to fix things up.
	    if ((cluster_results && cluster_results.errors) ||
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
		return;
	    }
	    window.location.replace("resgroup.php?edit=1" +
				    "&uuid=" + json.value.uuid);
	    return;
	};
	// Collect the cluster rows into an array.
	clusters = GetClusterRows();
	ranges   = GetRangeRows();

	// Clear (hide) previous cluster table errors
	$('#reserve-request-form .form-group-sm').addClass("hidden");
	$('#reserve-request-form tbody').removeClass("has-warning has-error");

	aptforms.SubmitForm('#reserve-request-form', "resgroup",
			    "Reserve", reserve_callback,
			    "Submitting your reservation request; "+
			    "patience please",
			    {"clusters" : clusters,
			     "ranges"   : ranges});
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
	    }
	    else {
		// Always show an empty range row.
		AddRangeRow();
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
	    RefreshTables(json.value);
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
	var thisuuid = $(row).attr('data-uuid');
	var count    = $(row).find(".node-count").val();
	var cluster  = $(row).find(".cluster-select option:selected").val();
	var type     =$(row).find(".hardware-select option:selected").val();

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
	$("history-graphs").html("");

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
	var combinedForecasts = {};
	console.info("RegenCombinedGraph", clusters);

	_.each(clusters, function (details) {
	    var urn  = details.cluster;
	    var type = details.type;

	    if (!_.has(amlist, urn)) {
		return;
	    }
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

    function isNumber(value) {
	if (isNaN(value)) {
	    return false;
	}
	var x = parseFloat(value);
	return isNaN(x) ? false : true;
    }
    $(document).ready(initialize);
});




