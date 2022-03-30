/*
 * Some extra stuff for OTA permission/agreement
 */
$(function () {
  window.otaStuff = (function()
    {
	'use strict';
	var templates  = null;
	var otaAllowed = null;

	function init(which)
	{
	    templates = APT_OPTIONS.fetchTemplateList(['ota-permission',
						       'ota-agreement']);

	    if ($('#otaAllowed-json').length) {
		otaAllowed = decodejson('#otaAllowed-json');
		console.info("otaAllowed", otaAllowed);
	    }
	    $("body").append(templates['ota-permission']);
	    // Text of OTA agreement inserted.
	    $("#need-ota-agreement .ota-agreement")
		.html(templates['ota-agreement']);

	    if (which === "resgroup") {
		$('#no-ota-permission .ota-instantiate').addClass("hidden");
		$('#no-ota-permission .ota-resgroup').removeClass("hidden");
	    }
	}

	// The server handles not sending repeat messages.
	function SendOtaAgreement(pid)
	{
	    sup.CallServerMethod(null,
				 "show-project", "SendotaAgreement",
				 {"pid" : pid},
				 function (json) {
				     console.info("SendotaAgreement", json);
				     alert("Project leader has been notified");
				 });
	}

	function OtaAgree(callback)
	{
			
	    sup.CallServerMethod(null, "ota-agreement", "Agree", null,
				 function (json) {
				     console.info("OTA Agree", json);
				     if (json.code) {
					 sup.SpitOops("oops",
						      json.value);
					 return;
				     }
				     callback(true);
				 });
	}

	function HasOtaPermission(pid)
	{
	    if (templates == null) {
		init();
	    }
	    var ota = otaAllowed[pid];

	    // User is allowed to continue. 
	    if (ota.allowed) {
		return 1;
	    }
	    return 0;
	}

	function RequestOtaPermission(pid)
	{
	    if (HasOtaPermission(pid)) {
		return 1;
	    }
	    var ota = otaAllowed[pid];
	    var url = "ota-agreement.php?pid=" + pid;

	    // The leader can be taken to the form directly.
	    // A member of the project can request email be sent to the leader.
	    if (ota.isleader) {
		$("#no-ota-permission .isleader").removeClass("hidden");
		$("#no-ota-permission .notleader").addClass("hidden");
	    }
	    else {
		$("#no-ota-permission .isleader").addClass("hidden");
		$("#no-ota-permission .notleader").removeClass("hidden");

		$('#no-ota-permission .ota-nagpi').click(function (event) {
		    event.preventDefault();
		    sup.HideModal('#no-ota-permission', function () {
			SendOtaAgreement(pid);
		    });
		});
	    }
	    $("#no-ota-permission .powder-project").html(pid);
	    $("#no-ota-permission .ota-link").attr("href", url);
	    sup.ShowModal("#no-ota-permission", function () {
		$('#no-ota-permission .ota-nagpi').off("click");
	    })
	    // User not allowed to continue
	    return 0;
	}

	// User cannot proceed without OTA agreement.
	function RequestOtaAgreement(callback)
	{
	    if (templates == null) {
		init();
	    }
	    // Agree checkbox enables/disables the submit button.
	    $('#need-ota-agreement input[name="agreed"]').change(function () {
		var ischecked = $(this).is(":checked");

		if (ischecked) {
		    $('#need-ota-agreement button[name="submit"]')
			.removeAttr("disabled");
		}
		else {
		    $('#need-ota-agreement button[name="submit"]')
			.attr("disabled", "disabled");
		}
	    });
	    $('#need-ota-agreement button[name="submit"]')
		.click(function (event) {
		    event.preventDefault();
		    sup.HideModal('#need-ota-agreement', function () {
			OtaAgree(callback);
		    });
		});
	    
	    sup.ShowModal("#need-ota-agreement", function () {
		$('#need-ota-agreement input[name="agreed"]').off("change");
		$('#need-ota-agreement button[name="submit"]').off("click");
	    });
	}

	// Helper.
	function decodejson(id) {
	    return JSON.parse(_.unescape($(id)[0].textContent));
	}

	// Exports from this module.
	return {
	    "init"                 : init,
	    "HasOtaPermission"     : HasOtaPermission,
	    "RequestOtaPermission" : RequestOtaPermission,
	    "RequestOtaAgreement"  : RequestOtaAgreement,
	};
    }
)();
});
