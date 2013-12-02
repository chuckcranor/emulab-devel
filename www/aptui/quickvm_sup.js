var myuuid = null;

function ShowModal(which) 
{
//   console.log('Showing modal ' + which);
    $( which ).modal('show');
}
    
function HideModal(which) 
{
//   console.log('Hide modal ' + which);
    $( which ).modal('hide');
}
    
function CallMethod(method, callback, uuid, arg)
{
    return $.ajax({
	// the URL for the request
	url: window.location.href,
 
	// the data to send (will be converted to a query string)
	data: {
	    uuid: uuid,
	    ajax_request: 1,
	    ajax_method: method,
	    ajax_argument: arg,
	},
 
	// whether this is a POST or GET request
	type: (arg ? "GET" : "GET"),
 
	// the type of data we expect back
	dataType : "json",
    });
}

function GetStatus(uuid)
{
    var callback = function(json) {
	StatusWatchCallBack(uuid, json);
    }
    var $xmlthing = CallMethod("status", null, uuid, null);
    $xmlthing.done(callback);
}

// Set up a timer to watch the status.
function StartStatusWatch(uuid)
{
    setTimeout(function f() { GetStatus(uuid) }, 5000);
}

// Call back for above.
function StatusWatchCallBack(uuid, json)
{
    // Check to see if the static variable has been initialized
    if (typeof StatusWatchCallBack.laststatus == 'undefined') {
        // It has not... perform the initilization
        StatusWatchCallBack.laststatus = "";
    }
    var status = json.value;
    if (json.code) {
	status = "terminated";
    }
    
    if (status != StatusWatchCallBack.laststatus) {
	status_html = status;
	
	if (status == 'provisioned') {
	    $("#quickvm_progress_bar").width("66%");
	}
	else if (status == 'ready') {
	    status_html = "<font color=green>ready</font>";
	    if ($("#quickvm_progress").length) {
		$("#quickvm_progress").removeClass("progress-striped");
		$("#quickvm_progress").removeClass("active");
		$("#quickvm_progress").addClass("progress-bar-success");
		$("#quickvm_progress_bar").width("100%");
	    }
	    $("#terminate_button").prop("disabled", false);
	    $("#extend_button").prop("disabled", false);
	    ShowTopo(uuid);
	}
	else if (status == 'failed') {
	    status_html = "<font color=red>failed</font>";
	    if ($("#quickvm_progress").length) {
		$("#quickvm_progress").removeClass("progress-striped");
		$("#quickvm_progress").removeClass("active");
		$("#quickvm_progress").addClass("progress-bar-danger");
		$("#quickvm_progress_bar").width("100%");
	    }
	    $("#terminate_button").prop("disabled", false);
	}
	else if (status == 'terminating' || status == 'terminated') {
	    status_html = "<font color=red>" + status + "</font>";
	    $("#terminate_button").prop("disabled", true);
	    $("#extend_button").prop("disabled", true);
	    StartCountdownClock.stop = 0;
	}
	$("#quickvm_status").html(status_html);
    } 
    StatusWatchCallBack.laststatus = status;
    if (! (status == 'terminating' || status == 'terminated')) {    
	setTimeout(function f() { GetStatus(uuid) }, 5000);
    }
}

function Terminate(uuid, url)
{
    var callback = function(json) {
	window.location.replace(url);
    }
    $("#terminate_button").prop("disabled", true);
    $("#extend_button").prop("disabled", true);
    HideModal('#terminate_modal');
    var $xmlthing = CallMethod("terminate", null, uuid, null);
    
    $xmlthing.done(callback);
}

function ShowTopo(uuid)
{
    var callback = function(json) {
	console.log(json.value);
	var xmlDoc = $.parseXML(json.value);
	var xml    = $(xmlDoc);
	var topo   = ConvertManifestToJSON(null, xml);
	console.log(topo);

	$("#showtopo_container").removeClass("invisible");
	maketopmap("#showtopo_div",
		   $("#showtopo_div").width(), 300, topo);

    }
    console.log(uuid);
    var $xmlthing = CallMethod("manifest", null, uuid, null);
    $xmlthing.done(callback);
}

function ShowProfile(direction)
{
    var profile;
    var index;
    
    if (direction) {
	var max = $('#profile_name option').length;
	console.log(max);
	index = ShowProfile.index + direction;
	
	if (index < 1) {
	    index = max;
	}
	else if (index >= max) {
	    index = 1;
	}
	profile = $("#profile_name :nth("+ index + ")").val();
    }
    else {
	// Use this static variable to track current index
	index = $("#profile_name").prop("selectedIndex");
	profile = $('#profile_name').val();
    }
    ShowProfile.index = index;
    console.log(profile);
    console.log(index);

    var callback = function(json) {
	console.log(json.value);
	var xmlDoc = $.parseXML(json.value.rspec);
	var xml    = $(xmlDoc);
	var topo   = ConvertManifestToJSON(profile, xml);
	console.log(topo);

	ShowModal("#quickvm_topomodal");
    
	$('#showtopo_title').html("<h3>" + profile + "</h3>");
	$('#showtopo_description').html(json.value.description);

	maketopmap("#showtopo_div",
		   ($("#showtopo_dialog").outerWidth()) - 90,
		   300, topo);
    }
    var $xmlthing = CallMethod("getprofile", null, 0, profile);
    $xmlthing.done(callback);
}

function ShowProfileSlider(direction)
{
    console.log(direction);
    
    var callback = function(json) {
	console.log(json.value);
	var xmlDoc = $.parseXML(json.value.rspec);
	var xml    = $(xmlDoc);
	var topo   = ConvertManifestToJSON(null, xml);
	console.log(topo);

	$('#showtopo_title').html("<h3>" + json.value.name + "</h3>");
	$('#showtopo_description').html(json.value.description);
	
	$("#slider_container").removeClass("invisible");
	maketopmap("#slider_div",
		   ($("#slider_div").outerWidth()) - 90,
		   200, topo);
    }
    var $xmlthing = CallMethod("getprofile", null, 0, null);
    $xmlthing.done(callback);
}

function InitProfileSelector()
{
    $('#scrollleft').click(function () {
	ShowProfile(-1);
    });
    $('#scrollright').click(function () {
	ShowProfile(1);
    });
    $('#showtopo_select').click(function () {
	HideModal("#quickvm_topomodal");
	profile = $("#profile_name :nth("+ ShowProfile.index + ")").val();	
	$('#profile_name').val(profile);
    });
}

function Setsshurl(uuid)
{
    var callback = function(json) {
	var xmlDoc = $.parseXML(json.value);
	var xml    = $(xmlDoc);
	var login  = $(xml).find("login");
	var user   = login.attr("username");
	var host   = login.attr("hostname");
	var port   = login.attr("port");
	var url    = "ssh://" + user + "@" + host + ":" + port + "/";
	var href   = "<a href='" + url + "'>" + url + "</a>";
	console.log(url);
	$("#quickvm_sshurl").html(href);
    }
    var $xmlthing = CallMethod("manifest", null, uuid, null);
    $xmlthing.done(callback);
}

//
// Request experiment extension.
//
function RequestExtension(uuid)
{
    var reason = $("#why_extend").val();
    console.log(reason);
    if (reason.length < 30) {
	alert("Your reason is too short! Say more please.");
	return;
    }
    var callback = function(json) {
	console.log(json.value);
	
	if (json.code) {
	    if (json.code < 0) {
		alert("Could not extend experiment. Please try again later");
	    }
	    else {
		alert("Could not extend experiment: " + json.value);
	    }
	    return;
	}
	$("#quickvm_expires").html(json.value);
	
	// Reset the countdown clock.
	StartCountdownClock.reset = json.value;
    }
    var $xmlthing = CallMethod("request_extension", null, uuid, reason);
    HideModal('#extend_modal');
    $xmlthing.done(callback);
}

function Extend(uuid)
{
    var code = $("#extend_code").val();
    console.log(code);
    if (code == "") {
	return;
    }
    var callback = function(json) {
	console.log(json.value);
    }
    var $xmlthing = CallMethod("extend", null, uuid, code);
    HideModal('#extend_modal');
    $xmlthing.done(callback);
}

//
// Open up a window to the account registration page.
//
function RegisterAccount(uid, email)
{
    HideModal('#register_modal');
    var url = "../newproject.php3?uid=" + uid + "&email=" + email + "";
    var win = window.open(url, '_blank');
    win.focus();
}

function InitQuickVM(uuid, slice_expires)
{
    // This activates the popover subsystem.
    $('[data-toggle="popover"]').popover({
	trigger: 'hover',
	'placement': 'top'
    });
    StartResizeWatchdog(uuid);
    StartCountdownClock(slice_expires);
    GetStatus(uuid);
    myuuid = uuid;
}

function resetForm($form) {
    $form.find('input:text, select, textarea').val('');
}

function StartSSH(id, authobject)
{
    var jsonauth = $.parseJSON(authobject);
	
    var callback = function(stuff) {
        var split   = stuff.split(':');
        var session = split[0];
    	var port    = split[1];

        var url   = jsonauth.baseurl + ':' + port + '/' + '#' +
            encodeURIComponent(document.location.href) + ',' + session;
        console.log(url);
        var iwidth  = $('#' + id).width();
        var iheight = 300;

        $('#' + id).html('<iframe id="' + id + '_iframe" ' +
			   'width=' + iwidth + ' ' +
                           'height=' + iheight + ' ' +
                           'src=\'' + url + '\'>');
    }
    var xmlthing = $.ajax({
	// the URL for the request
     	url: jsonauth.baseurl + '/d77e8041d1ad',
 
     	// the data to send (will be converted to a query string)
	data: {
	    auth: authobject,
	},
 
 	// Needs to be a POST to send the auth object.
	type: 'POST',
 
    	// Ask for plain text for easier parsing. 
	dataType : 'text',
    });
    xmlthing.done(callback);
}

//
// User clicked on a node, so we want to create a tab to hold
// the ssh tab with a panel in it, and then call StartSSH above
// to get things going.
//
function NewSSHTab(hostport, client_id)
{
    var pair = hostport.split(":");
    var host = pair[0];
    var port = pair[1];

    //
    // On first ssh, we convert the topo div into a tabs array,
    // and place each ssh session as a new tab.
    //
    if (! $("#quicktabs").length) {
	var html =
	    "<ul id='quicktabs' class='nav nav-tabs'>\n" +
	    " <li><a href='#profile' data-toggle='tab'>Profile</a></li>\n" +
	    "</ul>\n" +
	    "<div id='quicktabs_content' class='tab-content'>\n" +
	    " <div class='tab-pane' id='profile'>" +
	    "  <div id='showtopo_div'>\n" +
   	         $('#showtopo_div').html() +
	    "  </div>\n" +
	    " </div>\n" +
	    "</div>\n";
	$('#quicktabs_div').html(html);
    }
    //
    // Need to create the tab before we can create the topo, since
    // we need to know the dimensions of the tab.
    //
    var tabname = client_id + "_tab";
    if (! $("#" + tabname).length) {
	// The tab.
	var html = "<li><a href='#" + tabname + "' data-toggle='tab'>" +
	    client_id + "" +
            "<button class='close' type='button' " +
	    "        id='" + tabname + "_kill'>x</button>" +
	    "</a>" +
	    "</li>";	

	// Append to end of tabs
	$("#quicktabs_div ul").append(html);

	// Install a click handler for the X button.
	$("#" + tabname + "_kill").click(function(e) {
	    e.preventDefault();
	    // remove the li from the ul.
	    $(this).parent().remove();
	    // Remove the content div.
	    $("#" + tabname).remove();
	    // Activate the "profile" tab.
	    $('#quicktabs a[href="#profile"]').tab('show');
	})

	// The content div.
	html = "<div class='tab-pane' id='" + tabname + "'></div>";

	$("#quicktabs_content").append(html);

	// And make it active
	$('#quicktabs a:last').tab('show') // Select last tab
    }
    else {
	// Switch back to it.
	$('#quicktabs a[href="#' + tabname + '"]').tab('show');
	return;
    }

    // Ask the server for an authentication object that allows
    // to start an ssh shell.
    var callback = function(json) {
	console.log(json.value);

	if (json.code) {
	    alert("Failed to gain authentication for ssh.");
	}
	else {
	    StartSSH(tabname, json.value);
	}
    }
    var xmlthing = CallMethod("ssh_authobject", null, myuuid, hostport);
    xmlthing.done(callback);
}

//
// Install a window resize handler to redraw the topomap.
//
function StartResizeWatchdog(uuid)
{
    var resizeTimer;

    //
    // This does the actual work, called from the timer.
    //
    function resizeFunction() {
	console.log("resizing topo");
	// Must clear the div for the D3 library.
	$("#showtopo_div").html("<div></div>");
	$("#showtopo_div").removeClass("invisible");
	ShowTopo(uuid);
    }

    //
    // When we get (the first of a series) of resize events,
    // we want to throw away the current topograph and set a
    // timer that will run a little while later, to redraw
    // it in the newly sized container. But, resize events might
    // come pouring in as the user moves the moouse, so we just
    // kill the old one each time, and eventually it will fire
    // after the user stops dinking around.
    //
    $(window).resize(function() {
	$("#showtopo_div").addClass("invisible");
	
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(resizeFunction, 250);
    });
}

//
// Found this with a Google search.
//
function StartCountdownClock(when)
{
    console.log(when);

    // Use this static variable to force clock reset.
    StartCountdownClock.reset = when;

    // Force init below
    when = null;
    
    // Use this static variable to force clock stop
    StartCountdownClock.stop = 0;
    
    // date counting down to
    var target_date;

    // Need the timezone offset to format a local time.
    var timeOffsetInHours = (new Date().getTimezoneOffset()/60) * (-1);
    console.log(timeOffsetInHours);

    // variables for time units
    var days, hours, minutes, seconds;
    
    // update the tag with id "countdown" every 1 second
    var updater = setInterval(function () {
	// Clock stop
	if (StartCountdownClock.stop) {
	    // Amazing that this works!
	    clearInterval(updater);
	}
	
	// Clock reset
	if (StartCountdownClock.reset != when) {
	    when = StartCountdownClock.reset;

	    // Reformat in local time and show the user.
	    var local_date = new Date(when);
	    local_date.setHours(local_date.getHours() + timeOffsetInHours);

	    var local_string = local_date.format("yyyy-mm-dd hh:MM:ss Z");
	    $("#quickvm_expires").html(local_string);

	    // Countdown also based on local time. 
	    target_date = local_date.getTime();
	}
	
	// find the amount of "seconds" between now and target
	var current_date = new Date().getTime();
	var seconds_left = (target_date - current_date) / 1000;

	if (seconds_left <= 0) {
	    // Amazing that this works!
	    clearInterval(updater);
	    return;
	}
 
	// do some time calculations
	days = parseInt(seconds_left / 86400);
	seconds_left = seconds_left % 86400;
     
	hours = parseInt(seconds_left / 3600);
	seconds_left = seconds_left % 3600;
     
	minutes = parseInt(seconds_left / 60);
	seconds = parseInt(seconds_left % 60);

	if (days <= 9)
	    days = "0" + days;
	if (hours <= 9)
	    hours = "0" + hours;
	if (minutes <= 9)
	    minutes = "0" + minutes;
	if (seconds <= 9)
	    seconds = "0" + seconds;

	countdown = days + ":" + hours + ":" + minutes + ":" + seconds;  

	$("#quickvm_countdown").html(countdown);
    }, 1000);
}

function maketopmap(divname, width, height, json)
{
    $(divname).html("<div></div>");
    
    var vis = d3.select(divname).append("svg:svg")
	.attr("class", "topomap")
        .style("visibility", "hidden")
	.attr("width", width)
	.attr("height", height);

    vis.append("svg:rect")
	.attr("width", width)
	.attr("height", height)
        .style("fill-opacity", 0.0)
	.style("stroke", "#000");

    var topo = function(json) {
	var force = self.force = d3.layout.force()
	    .nodes(json.nodes)
	    .links(json.links)
	    .distance(150)
	    .charge(-400)
	    .size([width, height])
	    .start();

	var linkg = vis.selectAll("g.link")
	    .data(json.links)
	    .enter().append("svg:g");

	var link = linkg.append("svg:line")
	    .attr("class", "linkline")
	    .attr("x1", function(d) { return d.source.x; })
	    .attr("y1", function(d) { return d.source.y; })
	    .attr("x2", function(d) { return d.target.x; })
	    .attr("y2", function(d) { return d.target.y; });
	
	var linklabel = linkg.append("svg:text")
	    .attr("class", "linktext")
	    .attr("x", function(d) { return (d.source.x + d.target.x) / 2 })
	    .attr("y", function(d) { return (d.source.y + d.target.y) / 2 })
	    .text(function(d) { return d.name });

	var node_drag = d3.behavior.drag()
	    .on("dragstart", dragstart)
	    .on("drag", dragmove)
	    .on("dragend", dragend);

	function dragstart(d, i) {
	    // stops the force auto positioning before you start dragging
	    force.stop() 
	}

	function dragmove(d, i) {
	    d.px += d3.event.dx;
	    d.py += d3.event.dy;
	    d.x  += d3.event.dx;
	    d.y  += d3.event.dy;
	    // this is the key to make it work together with updating
	    // both px,py,x,y on d !
	    tick(null); 
	}

	function dragend(d, i) {
	    // of course set the node to fixed so the force doesn't
	    // include the node in its auto positioning stuff
	    d.fixed = true; 
	    force.resume();
	}

	var nodeg = vis.selectAll("g.node")
	    .data(json.nodes)
	    .enter().append("svg:g")
	    .call(node_drag);

//	var nodea = nodeg.append("svg:a")
//	    .attr("xlink:href", function(d) { return d.sshurl });
	
	var node = nodeg.append("svg:rect")
	    .attr("class", "nodebox")
	    .attr("onclick",
		  function(d) {
		      return "NewSSHTab('" + d.hostport + "', " +
			  "             '" + d.client_id + "')" })
	    .attr("x", "-10px")
	    .attr("y", "-10px")
	    .attr("width", "20px")
	    .attr("height", "20px");

	var nodelabel = nodeg.append("svg:text")
	    .attr("class", "nodetext")
	    .attr("dx", 16)
	    .attr("dy", ".35em")
	    .text(function(d) { return d.name });
	
	function tick(e) {
	    if (e && e.alpha < 0.05) {
		vis.style("visibility", "visible")
		force.stop();
		return;
	    }
	    if (0) {
		node.attr("x",
			  function(d) {
			      return d.x =
				  Math.max(10,
					   Math.min(width - 10, d.x));
			  })
		    .attr("y",
			  function(d) {
			      return d.y =
				  Math.max(10,
					   Math.min(height - 10, d.y));
			  });
		
	    }
	    else {
		nodeg.attr("transform", function(d) {
		    d.px = d.x = Math.max(12, Math.min(width - 12, d.x));
		    d.py = d.y = Math.max(12, Math.min(height - 12, d.y));
		    return "translate(" + d.x + "," + d.y + ")"; });
	    }
	    link.attr("x1", function(d) { return d.source.x; })
		.attr("y1", function(d) { return d.source.y; })
		.attr("x2", function(d) { return d.target.x; })
		.attr("y2", function(d) { return d.target.y; });
	    
	    linklabel.attr("x", function(d) { return (d.source.x + d.target.x)
					      / 2 })
		     .attr("y", function(d) { return (d.source.y + d.target.y)
					      / 2 });
	};
	force.on("tick", tick);
    }(json);

    return topo;
}

// Avoid recalc of the layout if we already have seen it. Stash
// json here and return it if we have it. 
var saved = new Object();

//
// Convert a manifest in XML to a JSON object of nodes and links.
//
function ConvertManifestToJSON(name, xml)
{
    if (name && saved[name]) {
	return saved[name];
    }
    var json = {
	"nodes": [],
	"links": [],
    };

    $(xml).find("node").each(function(){
	var client_id = $(this).attr("client_id");
	var jobj      = {"name" : client_id};
	
	var login  = $(this).find("login");
	if (login) {
	    var user   = login.attr("username");
	    var host   = login.attr("hostname");
	    var port   = login.attr("port");
	    var sshurl = "ssh://" + user + "@" + host + ":" + port + "/";

	    jobj.client_id = client_id;
	    jobj.hostport  = host + ":" + port;
	    jobj.sshurl    = sshurl;
	}
	json.nodes.push(jobj);
    });

    $(xml).find("link").each(function(){
	var client_id = $(this).attr("client_id");
	var link_type = $(this).find("link_type");

	if (link_type && $(link_type).attr("name") == "lan") {
	    console.log("Oops, a lan");
	}
	else {
	    var ifacerefs = $(this).find("interface_ref");
	    var source    = ifacerefs[0];
	    var target    = ifacerefs[1];

	    source = $(source);
	    target = $(target);
	    
	    var source_ifname = source.attr("client_id");
	    var target_ifname = target.attr("client_id");
	    var source_ifpair = source_ifname.split(":");
	    var target_ifpair = target_ifname.split(":");
	    var source_name   = source_ifpair[0];
	    var target_name   = target_ifpair[0];
	    var source_index  = null;
	    var target_index  = null;
	
	    // Javascript does not do dictionaries. Too bad.
	    for (i = 0; i < json.nodes.length; i++) {
		if (json.nodes[i].name == source_name) {
		    source_index = i;
		}
		if (json.nodes[i].name == target_name) {
		    target_index = i;
		}
	    }
	    json.links.push({"name"         : client_id,
			     "source"       : source_index,
			     "target"       : target_index,
			     "source_name"  : source_name,
			     "target_name"  : target_name,
			    });
	}
    });
    if (name) {
	saved[name] = json;
    }
    return json;
}
