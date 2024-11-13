//
// Profile Picker code. 
//
$(function () {
window.ProfilePicker = (function ()
{
    'use strict';

    var sysprojlist   = ['emulab-ops', 'PortalProfiles'];
    var psysprojlist  = ['PhantomNet', 'PortalProfiles'];
    var recentcount   = 5;
    var profilelist   = null;
    var projlist      = null;
    var multisite     = 0;
    var changeProfile = null;
    var viewer        = null;
    
    function initialize(args)
    {
	console.info("Picker Init", args);
	
	var profileToArray = _.pairs(args.profileList);
	var templates      = APT_OPTIONS.fetchTemplateList(['picker-modal']);
	var template       = _.template(templates['picker-modal']);

	profilelist    = args.profileList;
	projlist       = args.projList;
	multisite      = args.multiSite;
	changeProfile  = args.changeProfile;

	/*
	 * Sort the entire list by recently used. If a profile is public
	 * but the user has never used it, then lastused is for whoever
	 * used it last (global). 
	 */
	profileToArray = _.sortBy(profileToArray, function (value) {
	    return value[1].lastused;
	});
	// Note that sortBy orders by ascending, so reverse.
	profileToArray = profileToArray.reverse();

	// Filter out the profiles this user has actually used.
	var recentlist = _.filter(profileToArray, function(value) {
	    return value[1]['usecount'] > 0;
	});

	/*
	 * If the user has not used any profiles, then we are going
	 * to show most recently used profiles by other users. But
	 * need to change the picker to say Popular since saying
	 * Recent would be odd.
	 */
	var showPopular = 0;
	if (recentlist.length == 0) {
	    showPopular = 1;
	    recentlist = profileToArray;
	}
	recentlist = _.first(recentlist, recentcount);

	// Mark public profiles in specific projects.
	_.each(recentlist, function(obj, key) {
	    if (window.ISPNET) {
		if (_.contains(psysprojlist, obj[1].project)) {
		    obj[1].project = "System";
		}
	    }
	    else {
		if (_.contains(sysprojlist, obj[1].project)) {
		    obj[1].project = "System";
		}
	    }

	});
	var projcategories = MakeProfileCategories(profileToArray);

	$('#profile-picker-modal-div')
	    .html(template({
		profiles:           profilelist,
		categories:         projcategories,
		recent:             recentlist,
		showpopular:        showPopular,
		recents:            recentlist,
	    }));

	// Get the viewer initialized now.
	viewer = JacksViewer.create({
	    "root"       : $('#showtopo_div'),
	    "selector"   : '.showtopology-picker',
	    "showinfo"   : false,
	    "multisite"  : multisite,
	    "ifclass"    : "showtopology-picker",
	});	

	// We are told which profile to start with when the user opens
	// the picker for the first time.
	$('#profile_name li[value = ' + args.defaultProfile + ']:first')
	    .addClass("selected");
	
	// Check if the browser has cookies stating what sections they
	// previoiusly had minimized.
        CookieCollapse('#profile_name > span', 'pp_collpased');

	$('#picker-modal').on('shown.bs.modal', function() {
	    ChangePickerProfile($('#profile_name .selected'))
	});
	console.info("foo", $('button#change-profile').length);
	
	$('button#showtopo_cancel').click(function (event) {
	    event.preventDefault();
	    $('#picker-modal').modal('hide');
	});
	$('li.profile-item').click(function (event) {
	    event.preventDefault();
	    // Ignore clicks over the project. Probably a better way to do this.
	    if (! $(event.target).is("li")) {
		return;
	    }
	    ChangePickerProfile(event.target);
	});
	$('button#showtopo_select').click(function (event) {
	    event.preventDefault();
	    var selected = $('#picker-modal .selected').attr("value");
	    console.info("selected", selected);
	    changeProfile(selected);
	    $('#picker-modal').modal('hide');
	});
	/*
	 * Handler for scroll inside the picker. We want to send the
	 * event when the user stops scrolling.
	 */
	$('#profile_name').scroll(function (event) {
	    clearTimeout($.data(this, 'scrollTimer'));
	});

	// Profile picker search box.
	var profile_picker_timeout  = null;
	var profile_picker_searched = false;
	
	$("#profile_picker_search").on("keyup", function (event) {
	    var options   = $('#profile_name');
	    var userInput = $("#profile_picker_search").val();
	    userInput = userInput.toLowerCase();
	    window.clearTimeout(profile_picker_timeout);

	    profile_picker_timeout =
		window.setTimeout(function() {
		    var matches = 
			options.children("ul")
			.children("li").filter(function() {
			    var text = $(this).text();
			    text = text.toLowerCase();

			    if (text.indexOf(userInput) > -1)
				return true;
			    return false;
			});
		    options.children("ul").children("li").hide();
		    matches.show();
		    
		    if (userInput == '') {
			$('#title_recently_used').removeClass('hidden');
			$('#recently_used').removeClass('hidden');
			$('#title_favorites').removeClass('hidden');
			$('#favorites').removeClass('hidden');
			profile_picker_searched = false;
		    }
		    else {
			$('#title_recently_used').addClass('hidden');
			$('#recently_used').addClass('hidden');
			$('#title_favorites').addClass('hidden');
			$('#favorites').addClass('hidden');
			profile_picker_searched = true;
		    }
		}, 500);

	    // User types return while searching, if there was only one
	    // choice, then we select it. Convenience. 
	    if (event.keyCode == 13) {
		var matches = 
		    options.find("li").filter(function() {
			return (!$(this).parent().hasClass('hidden') &&
				$(this).css('display') == 'block');
		    });
		if (matches && matches.length == 1) {
		    ChangePickerProfile(matches[0]);
		}
	    }
	});

	// Click function for expanding and collapsing profile groups
	$('#profile_name > span').click(function() {
	    var ul = '#'+($(this).attr('id').slice('title-'.length));
	    if ($(this).children('.category_collapsable')
		.hasClass('expanded')) {
		$(ul).addClass('hidden');
		$(this).children('.category_collapsable')
		    .removeClass('expanded');
		$(this).children('.category_collapsable')
		    .addClass('collapsed');
	    }
	    else {
		$(ul).removeClass('hidden');
		$(this).children('.category_collapsable')
		    .addClass('expanded');
		$(this).children('.category_collapsable')
		    .removeClass('collapsed');
	    }

	    var collapsed = [];
	    $('#profile_name .category_collapsable.collapsed').each(function() {
		collapsed.push($(this).parent().attr('id'));
	    });
	    SetCookie('pp_collpased',JSON.stringify(collapsed),30);
	});
    }

    function ShowPicker()
    {
	console.info(event);
	$('#picker-modal').modal('show');
    };
    
    // Put profiles into the correct categories to be built in the template
    function MakeProfileCategories(profiles)
    {
	var result = {
	    favorite:{},myprofiles:{},inproj:{},sysproj:{},otherproj:{}};

	_.each(profiles, function(obj, key) {
	    key = obj[0];
	    obj = obj[1];
	  
	    var isSystem =
		(window.ISPNET && _.contains(psysprojlist, obj.project)) ||
		(!window.ISPNET &&_.contains(sysprojlist, obj.project));
	    
	    if (obj.favorite == 1) {
		if (isSystem) {
		    result.favorite[key] = $.parseJSON(JSON.stringify(obj));
		    result.favorite[key].project = "System";
		}
		else {
		    result.favorite[key] = obj;
		}
	    }
	    
	    if (window.USERNAME == obj.creator) {
		result.myprofiles[key] = obj;
	    }

	    if (isSystem) {
	      result.sysproj[key] = obj;
	    }

	    if (projlist && _.has(projlist, obj.project)) {
		if (!result.inproj[obj.project]) {
		    result.inproj[obj.project] = {};
		}
		result.inproj[obj.project][key] = obj;
	    }
	    else if (!isSystem) {
		result.otherproj[key] = obj;
	    }
	});
	console.info("MakeProfileCategories", result);
	return result;
    }

    // Handler to minimize span elements based on the cookie name
    function CookieCollapse(target, cookieName) {
	var cookie = GetCookie(cookieName);

	if (cookie != null) {  
	    var collapsed = JSON.parse(cookie);
    
	    $(target).each(function() {
		if (_.contains(collapsed, $(this).attr('id'))) {
		    $(this).children('.category_collapsable')
			.removeClass('expanded').addClass('collapsed');
		    var ul = '#'+($(this).attr('id').slice('title-'.length));
		    $(ul).addClass('hidden');
		}
	    });
	}
    } 

    // Cookie parser found from Google
    function GetCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
	    var c = ca[i];
	    while (c.charAt(0)==' ') c = c.substring(1,c.length);
	    if (c.indexOf(nameEQ) == 0)
		return c.substring(nameEQ.length,c.length);
	}
	return null;
    }
    
    function SetCookie(name, value, days) {
	// Delete existing cookies first
	var expires = "expires=Thu, 01 Jan 1970 00:00:01 GMT;";
	document.cookie = name + '=; ' + expires;

	var date = new Date();
	date.setTime(date.getTime()+(days*24*60*60*1000))

	var cookie = name + '=' + value +
		'; expires=' + date.toGMTString() + '; path=/';

	document.cookie = cookie;
    }

    function ChangePickerProfile(selectedElement) {
	if (!$(selectedElement).hasClass('selected')) {
	    $('#profile_name li').each(function() {
		$(this).removeClass('selected');
	    });
	    $(selectedElement).addClass('selected');
	}
	console.info("ChangePickerProfile: " +
		     $(selectedElement).attr('value'));
	
	var callback = function(json) {
	    console.info("profile", json);
	    if (json.code) {
		alert("Could not get profile: " + json.value);
		return;
	    }
	    var profile_blob = json.value;
	    var profileInfo  = profilelist[$(selectedElement).attr('value')]
	    var isFavorite   = profileInfo.favorite;
	    var description  = getDescription(profile_blob.rspec);	    

	    // Add title name and favorite button
	    $('#showtopo_title > h3').html(profile_blob.name);
	    if (isFavorite) {
		$('#set_favorite').addClass("favorite");
	    }
	    else {
		$('#set_favorite').removeClass("favorite");
	    }
	    $('#showtopo_author').html(profile_blob.creator);
	    $('#showtopo_project').html(profileInfo.project);  
	    $('#showtopo_version').html(profile_blob.version); 
	    $('#showtopo_last_updated').html(profile_blob.created);
	    $('#showtopo_description').html(description);
	    if (profile_blob.fromrepo) {
		var text = profile_blob.repohash.substr(0, 8) + " (" +
		    profile_blob.reporef + ")";
		$('#showtopo_repohash').html(text);
		$('.showtopo_repoinfo').removeClass("hidden");
	    }
	    else {
		$('.ashowtopo_repoinfo').addClass("hidden");
	    }

	    viewer.clear();
	    viewer.add(profile_blob.rspec);

	    // Set favorite toggle click event
	    $('#favorite_button').click(function() {
		ToggleFavorite(selectedElement)}
	    );
	};
	var args = {
	    "profile"   : $(selectedElement).attr('value'),
	    "getsource" : false,
	};
	sup.CallServerMethod(null, "instantiate", "GetProfile", args, callback);
    }

    /*
     * We now use the desciption from inside the rspec, unless there
     * is none, in which case look to see if the we got one in the
     * rpc reply, which we will until all profiles converted over to
     * new format rspecs.
     *
     * XXX This needs to be someplace else.
     */
    function getDescription(rspec)
    {
	var xmlDoc = $.parseXML(rspec);
	var xml    = $(xmlDoc);
	var description = null;
	    
	$(xml).find("rspec_tour").each(function() {
	    $(this).find("description").each(function() {
		description = marked($(this).text());
	    });
	});
	if (!description || description == "") {
	    description = "Hmm, no description for this profile";
	}
	return description;
    }
    
    function ToggleFavorite(target) {
	var wasFav = profilelist[$(target).attr('value')].favorite;
	var callback = function(e) {    
	    if (wasFav) {
		$('#set_favorite').removeClass('favorite');
		profilelist[$(target).attr('value')].favorite = 0;
		$('#favorites li[value='+$(target).attr('value')+']').remove();

		// They were selected on the item in the favorites
		// list, which was just removed Adjust their selection
		// to the first instance of that profile.
		if ($('#profile_name .selected').length == 0) {
		    $('#profile_name li[value='+$(target).attr('value')+']')[0].click();
		}

		if ($('#favorites li').length == 0) {
		    $('#title_favorites').addClass('hidden');
		}
	    }
	    else {
		$('#set_favorite').addClass('favorite');
		profilelist[$(target).attr('value')].favorite = 1;

		var clone = $(target).clone();
		$(clone).removeClass('selected');
		$('#favorites').append(clone);
		$(clone).click(function (event) {
		    event.preventDefault();
		    ChangePickerProfile(event.target);
		});

		$('#title_favorites').removeClass('hidden');
	    }
	}
	var $xmlthing =
	    sup.CallServerMethod(null, "instantiate",
				 (wasFav ? "ClearFavorite" : "MarkFavorite"),
				 {"uuid" : $(target).attr('value')});
	$xmlthing.done(callback);
    }

    // Exports from this module.
    return {
	"init"          : initialize,
	"showPicker"	: ShowPicker,
    };
}
)();
});
