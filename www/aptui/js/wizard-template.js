$(function () {
window.wt = (function() {

	function ClusterStatusHTML(options, fedlist) {
		var html = $('<div class="cluster_picker_status btn-group">'
					    +'<button type="button" class="form-control btn btn-default dropdown-toggle" data-toggle="dropdown">'
					    	+'<span class="value"></span>'
							+'<span class="caret"></span>'
					    +'</button>'
					    +'<ul class="dropdown-menu" role="menu">'
					    	+'<li role="separator" class="divider federatedDivider"><div>Federated Clusters<div></li>'
					    	+'<li role="separator" class="divider disabledDivider"></li>'
					    +'</ul>'
					+'</div>');

		var dropdown = html.find('.dropdown-menu .disabledDivider');
		var federated = html.find('.dropdown-menu .federatedDivider');
		var disabled = 0;
		var fed = 0;
		$(options).each(function() {
			if ($(this).prop('disabled')) {
				dropdown.after('<li class="disabled"><a data-toggle="tooltip" data-placement="right" data-html="true" title="<div>This testbed is incompatible with the selected profile</div>" href="#" value="'+$(this).attr('value')+'">'+$(this).attr('value')+'</a></li>')
				disabled++;
			}
			else {
				if (_.contains(fedlist, $(this).attr('value'))) {
					federated.after('<li class="enabled federated"><a href="#" value="'+$(this).attr('value')+'">'+$(this).attr('value')+'</a></li>');
					fed++;
				}
				else {
					var optvalue = $(this).attr('value');
					var opthidden = "";
					// Look for Please Select option
					if (optvalue == "") {
					    optvalue = $(this).text();
					    opthidden = ' hidden';
					}
					federated.before('<li class="enabled native'+opthidden+'"><a href="#" value="'+optvalue+'">'+optvalue+'</a></li>');
				}
			}
		});

		if (!disabled) {
			html.find('.disabledDivider').remove();
		}

		if (!fed) {
			html.find('.federatedDivider').remove();
		}

		return html;
	}

	function StatusClickEvent(html, that) {
		    html.find('.dropdown-toggle .value').html($(that).attr('value'));   
		    
		    if ($(that).find('.picker_stats').length) {
		    	if (!html.find('.dropdown-toggle > .picker_stats').length) {
		    		html.find('.dropdown-toggle').append('<div class="picker_stats"></div>');
		    	}
		    	else {
		    		html.find('.dropdown-toggle > .picker_stats').html('');
		    	}

		    	html.find('.dropdown-toggle > .picker_stats').append($(that).find('.picker_stats').html());
		    }
		    else {
		    	html.find('.dropdown-toggle > .picker_stats').html('');
		    }

		    html.find('.selected').removeClass('selected');
		    $(that).parent().addClass('selected');
	}

	function CalculateRating(data, type) {
		var health = 0;
		var rating = 0;
		var tooltip = [];

		if (data.status == 'SUCCESS') {
			if (data.health) {
				health = data.health;
				tooltip[0] = '<div>Testbed is '
				if (health > 50) {
					tooltip[0] += 'healthy';
				}
				else {
					tooltip[0] += 'unhealthy';
				}
				tooltip[0] += '</div>';
			}
			else {
				health = 100;
				tooltip[0] = '<div>Testbed is up</div>'
			}
		}
		else {
			tooltip[0] = '<div>Testbed is down</div>'
			return [health, rating, tooltip];
		}

		var available = [], max = [], label = [];
		if (_.contains(type, 'PC')) {
			available.push(parseInt(data.rawPCsAvailable));
			max.push(parseInt(data.rawPCsTotal));
			label.push('PCs');
		}
		if (_.contains(type, 'VM')) {
			available.push(parseInt(data.VMsAvailable));
			max.push(parseInt(data.VMsTotal));
			label.push('VMs');
		} 

		for (var i = 0; i < type.length; i++) {
			if (!isNaN(available[i]) && !isNaN(max[i])) {
				if (rating == 0) {
					rating = available[i];
				}
				var ratio = available[i]/max[i];
				tooltip.push('<div>'+available[i]+'/'+max[i]+' ('+Math.round(ratio*100)+'%) '+label[i]+' available</div>');
			}
		}
		return [health, rating, tooltip];
	}

	function InactiveRating() {
		return [0, 0, ['','Testbed status unavailable']]
	}

	function AssignStatusClass(health, rating) {
		var result = [];
		if (health >= 50) {
			result[0] = 'status_healthy';
		}
		else if (health > 0) {
			result[0] = 'status_unhealthy';
		}
		else {
			result[0] = 'status_down';
		}

		if (rating > 20) {
			result[1] = 'resource_healthy';
		}
		else if (rating > 10) {
			result[1] = 'resource_unhealthy';
		}
		else {
			result[1] = 'resource_down';
		}

		return result;
	}

	function AssignInactiveClass() {
		return ['status_inactive', 'resource_inactive']
	}

	function StatsLineHTML(classes, title) {
		var title1 = '';
		if (title[1]) {
			title1 = ' data-toggle="tooltip" data-placement="right" data-html="true" title="'
			for (var i = 1; i < title.length; i++) {
				title1 += title[i]+' ';
			}
			title1 += '"';
		}
		return '<div class="tooltip_div"'+title1+'><div class="picker_stats" data-toggle="tooltip" data-placement="left" data-html="true" title="'+title[0]+'">'
							+'<span class="picker_status '+classes[0]+' '+classes[1]+'"><span class="circle"></span></span>'
							+'</div></div>';
	}

	return {
		ClusterStatusHTML: ClusterStatusHTML,
		StatusClickEvent: StatusClickEvent,
		CalculateRating: CalculateRating,
		InactiveRating: InactiveRating,
		AssignStatusClass: AssignStatusClass,
		AssignInactiveClass: AssignInactiveClass,
		StatsLineHTML: StatsLineHTML
	};
}
)();
});
