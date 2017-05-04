$(function () {
window.wt = (function() {
	function StatusClickEvent(container, that, target) {
	    if ($(container).find('.dropdown-toggle > .value').html() == "") {
		var value = $(that).html();
		$(container).find('.dropdown-toggle > .value').html(value);
	    }
	    
	    if ($(that).find('.picker_stats').length) {
		if (!$(container).find('.dropdown-toggle > .picker_stats').length) {
		    $(container).find('.dropdown-toggle').append('<div class="'+$(that).find('.picker_stats').attr('class')+'"></div>');
		}
		else {
		    $(container).find('.dropdown-toggle > .picker_stats').html('');
		}

		$(container).find('.dropdown-toggle > .picker_stats').append($(that).find('.picker_stats').html());
	    }
	    else {
		$(container).find('.dropdown-toggle > .picker_stats').html('');
	    }

	    if ($(that).find('.warning_icon').length) {
		    console.log('callback');   
		    console.log(that);
		if (!$(container).find('.dropdown-toggle > .warning_icon').length) {
		    $(container).find('.dropdown-toggle').append('<div class="'+$(that).find('.warning_icon').attr('class')+'"></div>');
		}
		else {
		    $(container).find('.dropdown-toggle > .warning_icon').html('');
		}

		$(container).find('.dropdown-toggle > .warning_icon').append($(that).find('.warning_icon').html());
		if ($(that).find('.warning_icon').hasClass('warn')) {
		    $(container).find('.dropdown-toggle > .warning_icon').removeClass('confirm');
		    $(container).find('.dropdown-toggle > .warning_icon').addClass('warn');
		}
		else {
		    $(container).find('.dropdown-toggle > .warning_icon').removeClass('warn');
		    $(container).find('.dropdown-toggle > .warning_icon').addClass('confirm');
		}
	    }
	    else {
		$(container).find('.dropdown-toggle > .warning_icon').html('');
	    }


	    if ($(that).parent().attr('data-res-start')) {
 		var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
		var start = new Date(parseInt($(that).parent().attr('data-res-start')) * 1000);
		var startHours = start.getHours() < 10 ? '0' + start.getHours() : '' + start.getHours();
		var startMinutes = start.getMinutes() < 10 ? '0' + start.getMinutes() : '' + start.getMinutes();

		if ($(that).parent().attr('data-res-end')) {
		    $('#reservation_confirmation').addClass('hidden');
		    var end = new Date(parseInt($(that).parent().attr('data-res-end')) * 1000);

		    var endHours = end.getHours() < 10 ? '0' + end.getHours() : '' + end.getHours();
		    var endMinutes = end.getMinutes() < 10 ? '0' + end.getMinutes() : '' + end.getMinutes();

		    $('#reservation_warning .reservation_start').html(startHours + ':' + startMinutes + ', ' + months[start.getMonth()] + ' ' + start.getDate());
		    $('#reservation_warning .reservation_end').html(endHours + ':' + endMinutes + ', ' + months[end.getMonth()] + ' ' + end.getDate());
		    $('#reservation_warning').removeClass('hidden');
		} 
		else {
		    $('#reservation_warning').addClass('hidden');

		    if ($(that).parent().attr('data-now') == 'true') {
		    	$('#reservation_future').addClass('hidden');

			$('#reservation_confirmation .reservation_start').html(startHours + ':' + startMinutes + ', ' + months[start.getMonth()] + ' ' + start.getDate());
			$('#reservation_confirmation').removeClass('hidden');
		    }
		    else {
			$('#reservation_confirmation').addClass('hidden');

			$('#reservation_future .reservation_start').html(startHours + ':' + startMinutes + ', ' + months[start.getMonth()] + ' ' + start.getDate());
			$('#reservation_future').removeClass('hidden');
		    }

		}
	    }
	    $('[data-toggle="tooltip"]').tooltip();
	}

	function ResClickEvent(container, that, target) {
		console.log(that);
	    if ($(that).find('.warning_icon').length) {
		if (!$(container).find('.dropdown-toggle > .warning_icon').length) {
		    $(container).find('.dropdown-toggle').append('<div class="'+$(that).find('.warning_icon').attr('class')+'"></div>');
		}
		else {
		    $(container).find('.dropdown-toggle > .warning_icon').html('');
		}

		$(container).find('.dropdown-toggle > .warning_icon').append($(that).find('.warning_icon').html());
		if ($(that).find('.warning_icon').hasClass('warn')) {
		    $(container).find('.dropdown-toggle > .warning_icon').removeClass('confirm');
		    $(container).find('.dropdown-toggle > .warning_icon').addClass('warn');
		}
		else {
		    $(container).find('.dropdown-toggle > .warning_icon').removeClass('warn');
		    $(container).find('.dropdown-toggle > .warning_icon').addClass('confirm');
		}
	    }
	    else {
		$(container).find('.dropdown-toggle > .warning_icon').html('');
	    }

	    $(target).trigger('change');
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
		return '<div class="tooltip_div"'+title1+'><div class="picker_stats icon_position_1" data-toggle="tooltip" data-placement="left" data-html="true" title="'+title[0]+'">'
							+'<span class="picker_status '+classes[0]+' '+classes[1]+'"><span class="circle"></span></span>'
							+'</div></div>';
	}

	function ReservationWarningHTML(type, position) {
		return '<div class="reservation_tooltip no_reservation">'
			   +'<div class="warning_icon warn icon_position_'+position+'" '
				+'data-toggle="tooltip" '
				+'data-placement="right" '
				+'title="An upcoming reservation may impact the '
				+'availability of resources on this '+type+'.">'
			   +'<span class="glyphicon glyphicon-warning-sign '
					+'pull-right"></span>'
			+'</div></div>'
	}

	function HasReservationHTML(type, position) {
		return '<div class="reservation_tooltip has_reservation">'
			   +'<div class="warning_icon confirm icon_position_'+position+'" '
				+'data-toggle="tooltip" '
				+'data-placement="right" '
				+'title="You have an active reservation on this '+type+'.">'
			   +'<span class="glyphicon glyphicon-calendar '
					+'pull-right"></span>'
			+'</div></div>'
	}

	function FutureReservationHTML(type, position) {
		return '<div class="reservation_tooltip future_reservation">'
			   +'<div class="warning_icon warn icon_position_'+position+'" '
				+'data-toggle="tooltip" '
				+'data-placement="right" '
				+'title="You have an upcoming reservation on this '+type+'.">'
			   +'<span class="glyphicon glyphicon-calendar '
					+'pull-right"></span>'
			+'</div></div>'
	}

	return {
		StatusClickEvent: StatusClickEvent,
		ResClickEvent: ResClickEvent,
		CalculateRating: CalculateRating,
		InactiveRating: InactiveRating,
		AssignStatusClass: AssignStatusClass,
		AssignInactiveClass: AssignInactiveClass,
		StatsLineHTML: StatsLineHTML,
		ReservationWarningHTML: ReservationWarningHTML,
		HasReservationHTML: HasReservationHTML,
		FutureReservationHTML: FutureReservationHTML
	};
}
)();
});
