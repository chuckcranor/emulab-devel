function ShowModal(which) 
{
    modal = new $.UIkit.modal.Modal(which);
    modal.show();
    console.log('Showing modal ' + which);
}
    
function HideModal(which) 
{
    $( which ).hide();
    console.log('Showing modal ' + which);
}
    
function CallMethod(method, callback, uuid, arg)
{
    return $.ajax({
	// the URL for the request
	url: "quickvm_status.php",
 
	// the data to send (will be converted to a query string)
	data: {
	    uuid: uuid,
	    ajax_request: 1,
	    ajax_method: method,
	    ajax_argument: arg,
	},
 
	// whether this is a POST or GET request
	type: "GET",
 
	// the type of data we expect back
	dataType : "json",
    });
}

function GetStatus(uuid)
{
    var callback = function(json) {
	StatusWatchCallBack(uuid, json.value);
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
function StatusWatchCallBack(uuid, status)
{
    // Check to see if the static variable has been initialized
    if (typeof StatusWatchCallBack.laststatus == 'undefined') {
        // It has not... perform the initilization
        StatusWatchCallBack.laststatus = "";
    }
    console.log(status);
    
    if (status != StatusWatchCallBack.laststatus) {
	status_html = status;
	
	if (status == 'provisioned') {
	    $("#quickvm_progress_bar").width("66%");
	}
	else if (status == 'ready') {
	    status_html = "<font color=green>ready</font>";
	    if ($("#quickvm_progress").length) {
		$("#quickvm_progress").removeClass("uk-progress-striped");
		$("#quickvm_progress").removeClass("uk-active");
		$("#quickvm_progress").addClass("uk-progress-success");
		$("#quickvm_progress_bar").width("100%");
	    }
	    ShowTopo(uuid);
	}
	else if (status == 'failed') {
	    status_html = "<font color=yellow>failed</font>";
	    if ($("#quickvm_progress").length) {
		$("#quickvm_progress").removeClass("uk-progress-striped");
		$("#quickvm_progress").removeClass("uk-active");
		$("#quickvm_progress").addClass("uk-progress-danger");
		$("#quickvm_progress_bar").width("100%");
	    }
	}
	else if (status == 'terminating') {
	    status_html = "<font color=red>failed</font>";
	    $("#terminate_button").prop("disabled", true);
	    $("#extend_button").prop("disabled", true);
	}
	$("#quickvm_status").html(status_html);
    } 
    StatusWatchCallBack.laststatus = status;
    if (status != "terminating") {
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
    var $xmlthing = CallMethod("terminate", null, uuid, null);
    
    $xmlthing.done(callback);
}

function ShowTopo(uuid)
{
    var callback = function(json) {
	if (json.value == "") {
	    return;
	}
	console.log(json.value);
	var html = "<div>" + json.value + "</div>";

	$("#showtopo_div").html(html);
    }
    var $xmlthing = CallMethod("gettopomap", null, uuid, null);
    
    $xmlthing.done(callback);
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
	// StartGateOne(url);
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
    if (reason == "") {
	return;
    }
    var callback = function(json) {
	alert("Your request has been sent");
    }
    var $xmlthing = CallMethod("request_extension", null, uuid, reason);
    $('#extend_modal').hide();
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
	alert("Your request has been sent");
    }
    var $xmlthing = CallMethod("extend", null, uuid, code);
    $('#extend_modal').hide();
    $xmlthing.done(callback);
}

//
// Open up a window to the account registration page.
//
function RegisterAccount(uid, email)
{
    $('#register_modal').hide();
    var url = "../newproject.php3?uid=" + uid + "&email=" + email + "";
    var win = window.open(url, '_blank');
    win.focus();
}

var gateone_authobject = null;
var gateone_location   = null;

function InitQuickVM(uuid, location, auth_object)
{
    gateone_authobject = auth_object;
    gateone_location   = location;
    GetStatus(uuid);
}

function resetForm($form) {
    $form.find('input:text, select, textarea').val('');
}

function StartSSH(uuid, sshurl)
{
    var current_date = new Date().getTime();

    GateOne.location = "loc" + current_date;
    
    var callback = function(json) {
	console.log(json.value);
    }
    var $xmlthing = CallMethod("gateone_authobject", null, uuid, null);
    $xmlthing.done(callback);
}

function StartGateOne(sshurl)
{
    GateOne.location = gateone_location;
    
    // Initialize Gate One:
    GateOne.init({"url" :  'https://users.emulab.net:1090/gateone',
  	          "autoConnectURL" : sshurl,
		  "fillContainer"  : false,
		  "showToolbar"    : false,
		  "terminalFont"   : 'monospace',
                  "auth"           : gateone_authobject});
}

//
// Found this with a Google search.
//
function StartCountdownClock(when)
{
    // set the date we're counting down to
    var target_date = new Date(when).getTime();
 
    // variables for time units
    var days, hours, minutes, seconds;
 
    // update the tag with id "countdown" every 1 second
    setInterval(function () {
	// find the amount of "seconds" between now and target
	var current_date = new Date().getTime();
	var seconds_left = (target_date - current_date) / 1000;

	if (seconds_left <= 0) {
	    $("#terminate_button").prop("disabled", true);
	    $("#extend_button").prop("disabled", true);
	    return;
	}
 
	// do some time calculations
	days = parseInt(seconds_left / 86400);
	seconds_left = seconds_left % 86400;
     
	hours = parseInt(seconds_left / 3600);
	seconds_left = seconds_left % 3600;
     
	minutes = parseInt(seconds_left / 60);
	seconds = parseInt(seconds_left % 60);

	if (days < 9)
	    days = "0" + days;
	if (hours < 9)
	    hours = "0" + hours;
	if (minutes < 9)
	    minutes = "0" + minutes;
	if (seconds < 9)
	    seconds = "0" + seconds;

	countdown = days + ":" + hours + ":" + minutes + ":" + seconds;  

	$("#quickvm_countdown").html(countdown);
    }, 1000);
}
