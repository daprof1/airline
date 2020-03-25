var flightPaths = {} //key: link id, value : { path, shadow }
var flightMarkers = {} //key: link id, value: { markers : array[], animation}

var tempPath //temp path for new link creation
var loadedLinks = []
var loadedLinksById = {}
var currentAnimationStatus = true
var currentAirlineAllianceMembers = []
function updateAirlineInfo(airlineId) {
	$.ajax({
		type: 'GET',
		url: "airlines/" + airlineId,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    async: false,
	    success: function(airline) {
	    	refreshTopBar(airline)
	    	$(".currentAirline").html(getAirlineLogoImg(airline.id) + airline.name)

	    	if (airline.headquarterAirport) {
                        $("#currentAirlineCountry").html("<img class='flag' src='assets/images/flags/" + airline.headquarterAirport.countryCode + ".png' />")
	    	} else {
                        $("#currentAirlineCountry").empty()
	    	}
	    	activeAirline = airline
	    	updateLinksInfo()
	    	updateAirportMarkers(airline)
	    	updateAirlineLogo()
	    	updateLogoUpload()
	    },
	    error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}

function updateAirlineLogo() {
	$('.airlineLogo').attr('src', '/airlines/' + activeAirline.id + "/logo?dummy=" + Math.random())
}
	
	
function refreshTopBar(airline) {
	changeColoredElementValue($(".balance"), airline.balance)
	changeColoredElementValue($(".reputation"), airline.reputation)
	$(".reputationLevel").text("(" + airline.gradeDescription + ")")
	$(".reputationStars").html(getGradeStarsImgs(airline.gradeValue))
}

function getGradeStarsImgs(gradeValue) {
	var fullStars = Math.floor(gradeValue / 2)
	var halfStar = gradeValue % 2
	var html = ""
	for (i = 0 ; i < fullStars; i ++) {
		html += "<img src='assets/images/icons/star.png'/>"
	}
	if (halfStar) {
		html += "<img src='assets/images/icons/star-half.png'/>"
	}
	for (i = 0 ; i < 5 - fullStars - halfStar; i ++) {
		html += "<img src='assets/images/icons/star-empty.png'/>"
	}
	return html
}

function loadAirlines() {
	$.ajax({
		type: 'GET',
		url: "airlines",
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(airlines) {
	    	$.each(airlines, function( key, airline ) {
	    		var optionItem = $("<option></option>").attr("value", airline.id).text(airline.name)
	    		$("#airlineOption").append(optionItem);
	  		});
	    	
	    	if ($("#airlineOption option:first")) {
	    		selectAirline($("#airlineOption option:first").val())
	    	}
	    	
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}

function selectAirline(airlineId) {
	initWebSocket(airlineId)
	updateAllPanels(airlineId)
}

function buildBase(isHeadquarter, scale) {
	scale = scale || 1
	var url = "airlines/" + activeAirline.id + "/bases/" + activeAirportId 
	var baseData = { 
			"airportId" : parseInt(activeAirportId),
			"airlineId" : activeAirline.id,
			"scale" : scale,
			"headquarter" : isHeadquarter}
	$.ajax({
		type: 'PUT',
		url: url,
	    contentType: 'application/json; charset=utf-8',
	    data: JSON.stringify(baseData),
	    dataType: 'json',
	    success: function() {
	    	updateAllPanels(activeAirline.id)
	    	showWorldMap()
	    	if (scale == 1 && isHeadquarter) {
	    		$('#planLinkFromAirportId').val(activeAirline.headquarterAirport.airportId)
	    		loadAllCountries() //has a home country now, reload country info
	    	}
	    	
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}

function deleteBase() {
	var url = "airlines/" + activeAirline.id + "/bases/" + activeAirportId 
	
	$.ajax({
		type: 'DELETE',
		url: url,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function() {
	    	updateAllPanels(activeAirline.id)
	    	showWorldMap()
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}

function downgradeBase() {
	var url = "airlines/" + activeAirline.id + "/downgradeBase/" + activeAirportId 
	
	$.ajax({
		type: 'GET',
		url: url,
	    contentType: 'application/json; charset=utf-8',
	    success: function() {
	    	updateAllPanels(activeAirline.id)
	    	showWorldMap()
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}

function clearMarkerEntry(markerEntry) {
	//remove all animation intervals
	window.clearInterval(markerEntry.animation)
	
	//remove all markers
	$.each(markerEntry.markers, function(key, marker) {
		marker.setMap(null)
	})
}

function clearPathEntry(pathEntry) {
	pathEntry.path.setMap(null)
	pathEntry.shadow.setMap(null)
}

function clearAllPaths() {
	$.each(flightMarkers, function( linkId, markerEntry ) {
		clearMarkerEntry(markerEntry)
	});
	//remove all links from UI first
	$.each(flightPaths, function( key, pathEntry ) {
		clearPathEntry(pathEntry)
	})
	
	flightPaths = {}
	flightMarkers = {}
	
	$.each(polylines, function(index, polyline) {
		if (polyline.getMap() != null) {
			polyline.setMap(null)
		}
	})
	
	polylines = polylines.filter(function(polyline) { 
	    return polyline.getMap() != null
	})
}

//remove and re-add all the links
function updateLinksInfo() {
	clearAllPaths()

	if (activeAirline) {
		var url = "airlines/" + activeAirline.id + "/links?getProfit=true"
		
		$.ajax({
			type: 'GET',
			url: url,
		    contentType: 'application/json; charset=utf-8',
		    dataType: 'json',
		    async: false,
		    success: function(links) {
		    	$.each(links, function( key, link ) {
		    		drawFlightPath(link)
		  		});
		    	updateLoadedLinks(links);
		    },
	        error: function(jqXHR, textStatus, errorThrown) {
		            console.log(JSON.stringify(jqXHR));
		            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
		    }
		});
	}
}

//refresh links without removal/addition
function refreshLinks(forceRedraw) {
	var url = "airlines/" + activeAirline.id + "/links?getProfit=true"
	
	$.ajax({
		type: 'GET',
		url: url,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(links) {
	    	$.each(links, function( key, link ) {
	    		refreshFlightPath(link, forceRedraw)
	  		});
	    	updateLoadedLinks(links);
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}



function drawFlightPath(link, linkColor) {
	
   if (!linkColor) {
	   linkColor = getLinkColor(link.profit, link.revenue) 
   }
   var flightPath = new google.maps.Polyline({
     path: [{lat: link.fromLatitude, lng: link.fromLongitude}, {lat: link.toLatitude, lng: link.toLongitude}],
     geodesic: true,
     strokeColor: linkColor,
     strokeOpacity: pathOpacityByStyle[currentStyles].normal,
     strokeWeight: 2,
     frequency : link.frequency,
     modelId : link.modelId,
     link : link,
     zIndex: 90
   });
   
   var icon = "assets/images/icons/airplane.png"
   
   flightPath.setMap(map)
   polylines.push(flightPath)
   
   var shadowPath = new google.maps.Polyline({
	     path: [{lat: link.fromLatitude, lng: link.fromLongitude}, {lat: link.toLatitude, lng: link.toLongitude}],
	     geodesic: true,
	     map: map,
	     strokeColor: getLinkColor(link.profit, link.revenue),
	     strokeOpacity: 0.001,
	     strokeWeight: 15,
	     zIndex: 100
	   });
   
   var resultPath = { path : flightPath, shadow : shadowPath }
   if (link.id) {
	  shadowPath.addListener('click', function() {
	   		selectLinkFromMap(link.id, false)
	  });
      drawFlightMarker(flightPath, link);
	  flightPaths[link.id] = resultPath 
   }
   
   return resultPath
}

function refreshFlightPath(link, forceRedraw) {
	if (flightPaths[link.id]) {
		var path = flightPaths[link.id].path
		if (forceRedraw || path.frequency != link.frequency || path.modelId != link.modelId) { //require marker change
			path.frequency = link.frequency
			path.modelId = link.modelId
			
			drawFlightMarker(path, link)
		} 
		path.setOptions({ strokeColor : getLinkColor(link.profit, link.revenue), strokeOpacity : pathOpacityByStyle[currentStyles].normal })
	
		//flightPaths[link.id].setOptions({ strokeColor : getLinkColor(link)})
	}
}

function getLinkColor(profit, revenue) {
   if (profit !== undefined) {
	   var maxProfitFactor = 0.5
	   var minProfitFactor = -0.5
	   var profitFactor
	   if (revenue > 0) {
		   profitFactor = profit / revenue
	   } else if (profit < 0) { //revenue 0, losing money
		   profitFactor = minProfitFactor
	   } else {
		   profitFactor = 0
	   }
	   
	   if (profitFactor > maxProfitFactor) {
		   profitFactor = maxProfitFactor
	   } else if (profitFactor < minProfitFactor) {
		   profitFactor = minProfitFactor
	   }
	   var redHex 
	   if (profitFactor > 0) {
		   redHex = 220 * (1 - (profitFactor / maxProfitFactor)) 
	   } else { 
		   redHex = 220 
	   }
	   var greenHex
	   if (profitFactor < 0) { 
		   greenHex = 220 * (1 + (profitFactor / maxProfitFactor)) 
	   } else { 
		   greenHex = 220 
	   }
	   if (currentStyles === "light") {
	      redHex -= 50
	      greenHex -= 50
	   }
	   if (redHex < 0) redHex = 0
	   if (greenHex < 0) greenHex = 0

	   
	   var redHexString = parseInt(redHex).toString(16)
	   if (redHexString.length == 1) { redHexString = "0" + redHexString }
	   var greenHexString = parseInt(greenHex).toString(16)
	   if (greenHexString.length == 1) { greenHexString = "0" + greenHexString }
	   return colorHex = "#" + redHexString + greenHexString + "20"
   } else  { //no history yet
	   return "#DCDC20"
   }
}

function highlightPath(path, refocus) {
	refocus = refocus || false
	//focus to the from airport
	if (refocus) {
		map.setCenter(path.getPath().getAt(0))
	}

	
	if (!path.highlighted) { //only highlight again if it's not already done so
	    path.setOptions({ strokeOpacity : pathOpacityByStyle[currentStyles].highlight })
		var originalColorString = path.strokeColor
		path.originalColor = originalColorString
		var totalFrames = 20
		
		var rgbHexValue = parseInt(originalColorString.substring(1), 16);
		var currentRgb = { r : rgbHexValue >> (4 * 4), g : rgbHexValue >> (2 * 4) & 0xff, b : rgbHexValue & 0xff }
		var highlightColor = { r : 0xff, g : 0xff, b : 0xff}
		var colorStep = { r : (highlightColor.r - currentRgb.r) / totalFrames, g : (highlightColor.g - currentRgb.g) / totalFrames, b : (highlightColor.b - currentRgb.b) / totalFrames }
		var currentFrame = 0
		var animation = window.setInterval(function() {
			if (currentFrame < totalFrames) { //transition to highlight color
				currentRgb = { r : currentRgb.r + colorStep.r, g : currentRgb.g + colorStep.g, b : currentRgb.b + colorStep.b }
			} else { //transition back to original color
				currentRgb = { r : currentRgb.r - colorStep.r, g : currentRgb.g - colorStep.g, b : currentRgb.b - colorStep.b }
			}
			//convert currentRgb back to hexstring
			var redHex = Math.round(currentRgb.r).toString(16)
			if (redHex.length < 2) {
				redHex = "0" + redHex
			}
			var greenHex = Math.round(currentRgb.g).toString(16)
			if (greenHex.length < 2) {
				greenHex = "0" + greenHex
			}
			var blueHex = Math.round(currentRgb.b).toString(16)
			if (blueHex.length < 2) {
				blueHex = "0" + blueHex
			}
			 
			var colorHexString = "#" + redHex + greenHex + blueHex
			path.setOptions({ strokeColor : colorHexString , strokeWeight : 4, zIndex : 91})
			
			currentFrame = (currentFrame + 1) % (totalFrames * 2)
			
		}, 50)
		path.animation = animation
		
		path.highlighted = true
	}		
	
}
function unhighlightPath(path) {
	window.clearInterval(path.animation)
	path["animation"] = undefined
	path.setOptions({ strokeColor : path.originalColor , strokeWeight : 2, zIndex : 90, strokeOpacity : pathOpacityByStyle[currentStyles].normal})
	
	delete path.highlighted
}

function toggleMapAnimation() {
	if (currentAnimationStatus) {
		currentAnimationStatus = false
	} else {
		currentAnimationStatus = true
	}
	refreshLinks(true)	
}


//Use the DOM setInterval() function to change the offset of the symbol
//at fixed intervals.
function drawFlightMarker(line, link) {
	var linkId = link.id
	
	//clear the old entry first
	var oldMarkerEntry = flightMarkers[link.id]
	if (oldMarkerEntry) {
		clearMarkerEntry(oldMarkerEntry)
	}
	
	if (currentAnimationStatus && link.assignedAirplanes && link.assignedAirplanes.length > 0) {
		var from = line.getPath().getAt(0)
		var to = line.getPath().getAt(1)
		var image = {
	        url: "assets/images/markers/dot.png",
	        origin: new google.maps.Point(0, 0),
	        anchor: new google.maps.Point(6, 6),
	    };



		var frequency = link.frequency
//		var airplaneCount = link.assignedAirplanes.length
//		var frequencyByAirplane = {}
//		$.each(link.assignedAirplanes, function(key, airplane) {
//			frequencyByAirplane[key] = Math.floor(frequency / airplaneCount)
//		})
//		for (i = 0; i < frequency % airplaneCount; i++) { //assign the remainder
//			frequencyByAirplane[i] = frequencyByAirplane[i] + 1
//		}
        var animationInterval = 100
        var minsPerInterval = 1
        var minutesPerWeek = 60 * 24 * 7
        var maxTripsPerMarker = (60 * 24 * 7) / (link.duration * 2) //how many round trips can a marker make in a week, assuming a marker go back and forth right the way
        var markersRequired = Math.ceil(frequency / maxTripsPerMarker)
        var totalIntervalsPerWeek = minutesPerWeek / minsPerInterval //min in a week, assume each interval is 1 mins

		var markersOfThisLink = []
		for (i = 0; i < markersRequired; i ++) {
			var marker = new google.maps.Marker({
			    position: from,
			    icon : image, 
			    totalDuration : link.duration * 2, //round trip
			    elapsedDuration : 0,
			    nextDepartureFrame : Math.floor((i + 0.1) * totalIntervalsPerWeek / frequency) % totalIntervalsPerWeek, //i + 0.1 so they wont all depart at the same time
				departureInterval : Math.floor(totalIntervalsPerWeek / markersRequired),
				status : "forward",
			    isActive: false,
			    clickable: false,
			});
			
			//flightMarkers.push(marker)
			markersOfThisLink.push(marker)
		}
		
		flightMarkers[linkId] = {} //initialize
		flightMarkers[linkId].markers = markersOfThisLink
		
		var count = 0;
		var animation = window.setInterval(function() {
			$.each(markersOfThisLink, function(key, marker) { 
				if (count == marker.nextDepartureFrame) {
					if (christmasMarker) {
						marker.icon = {
						        url: randomFlightMarker(),
						        origin: new google.maps.Point(0, 0),
						        anchor: new google.maps.Point(6, 6),
						    };
					}
					marker.status = "forward"
					marker.isActive = true
					marker.elapsedDuration = 0
					marker.setPosition(from)
					marker.setMap(map)
				} else if (marker.isActive) {
					marker.elapsedDuration += minsPerInterval
					
					if (marker.elapsedDuration >= marker.totalDuration) { //finished a round trip
						//marker.setMap(null)
						fadeOutMarker(marker, animationInterval)
						marker.isActive = false
						marker.nextDepartureFrame = (marker.nextDepartureFrame + marker.departureInterval) % totalIntervalsPerWeek
						//console.log("next departure " + marker.nextDepartureFrame)
					} else {
					    if (marker.status === "forward") {
					         if (marker.elapsedDuration / marker.totalDuration >= 0.45) { //finished forward, now go into turnaround
                                marker.status = "turnaround"
					         } else {
					            var newPosition = google.maps.geometry.spherical.interpolate(from, to, marker.elapsedDuration / marker.totalDuration / 0.45)
                                marker.setPosition(newPosition)
                             }
                        }
                        if (marker.status === "turnaround") {
                             if (marker.elapsedDuration / marker.totalDuration >= 0.55) { //finished turnaround, now go into backward
                                marker.status = "backward"
                             }
                        }
                        if (marker.status === "backward") {
                            var newPosition = google.maps.geometry.spherical.interpolate(to, from, (marker.elapsedDuration / marker.totalDuration - 0.55) / 0.45)
                            marker.setPosition(newPosition)
                        }

					}
				}
			})
			count = (count + 1) % totalIntervalsPerWeek;
		}, animationInterval)
		
		flightMarkers[linkId].animation = animation;
	}
}


/**
 * deselect a currently selected link, perform both UI and underlying data changes
 * @returns
 */
function deselectLink() {
	if (selectedLink) {
		unhighlightLink(selectedLink)
		selectedLink = undefined
	}
	removeTempPath()
	$("#sidePanel").fadeOut(200)
}

/**
 * Perform UI changes for unhighlighting currently highlighted link
 * @param linkId
 * @returns
 */
function unhighlightLink() {
	$.each(flightPaths, function(linkId, path) {
		if (path.path.highlighted) {
			unhighlightPath(path.path)
		}
	})
		
}

/**
 * Performs UI changes to highlight a link
 */
function highlightLink(linkId, refocus) {
	if (tempPath) {
		removeTempPath(tempPath)
	}
	
	//highlight the selected link's flight path
	highlightPath(flightPaths[linkId].path, refocus)
	
	//highlight the corresponding list item
//	var selectedListItem = $("#linkList a[data-link-id='" + linkId + "']")
//	selectedListItem.addClass("selected")
}

function refreshLinkDetails(linkId) {
	var airlineId = activeAirline.id
	
	$("#linkCompetitons .data-row").remove()
	$("#actionLinkId").val(linkId)
	
	//load link
	$.ajax({
		type: 'GET',
		url: "airlines/" + airlineId + "/links/" + linkId,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(link) {
	    	var availableFromSlot = link.maxFrequencyFromAirport
	    	var availableToSlot = link.maxFrequencyToAirport
	    	if (link.future) {
                availableFromSlot -= link.future.frequency
                availableToSlot -= link.future.frequency
	    	} else {
                availableFromSlot -= link.frequency
                availableToSlot -= link.frequency
            }
	    	
	    	$("#linkFromAirport").attr("onclick", "showAirportDetails(" + link.fromAirportId + ")").html(getCountryFlagImg(link.fromCountryCode) + getAirportText(link.fromAirportCity, link.fromAirportCode) + '&nbsp;' + availableFromSlot + " available slot(s)")
	    	//$("#linkFromAirportExpectedQuality").attr("onclick", "loadLinkExpectedQuality(" + link.fromAirportId + "," + link.toAirportId + "," + link.fromAirportId + ")")
	    	$("#linkToAirport").attr("onclick", "showAirportDetails(" + link.toAirportId + ")").html(getCountryFlagImg(link.toCountryCode) + getAirportText(link.toAirportCity, link.toAirportCode)+ '&nbsp;' + availableToSlot + " available slot(s)")
	    	//$("#linkToAirportExpectedQuality").attr("onclick", "loadLinkExpectedQuality(" + link.fromAirportId + "," + link.toAirportId + "," + link.toAirportId + ")")
	    	$("#linkFlightCode").text(link.flightCode)
	    	if (link.assignedAirplanes && link.assignedAirplanes.length > 0) {
	    		$('#linkAirplaneModel').text(link.assignedAirplanes[0].airplane.name + "(" + link.assignedAirplanes.length + ")")
	    	} else {
	    		$('#linkAirplaneModel').text("-")
	    	}
	    	$("#linkCurrentPrice").text(toLinkClassValueString(link.price, "$"))
	    	$("#linkDistance").text(link.distance + " km")
	    	$("#linkQuality").html(getGradeStarsImgs(Math.round(link.computedQuality / 10)) + link.computedQuality)
	    	$("#linkCurrentCapacity").text(toLinkClassValueString(link.capacity))
	    	if (link.future) {
	    	    $("#linkCurrentDetails .future .capacity").text(toLinkClassValueString(link.future.capacity))
	    	    $("#linkCurrentDetails .future").show()
	    	} else {
	    	    $("#linkCurrentDetails .future").hide()
	    	}
	    	$("#linkCurrentDetails").show()
	    	$("#linkToAirportId").val(link.toAirportId)
	    	$("#linkFromAirportId").val(link.fromAirportId)
	    	
	    	//load competition
	    	$.ajax({
	    		type: 'GET',
	    		url: "airports/" + link.fromAirportId + "/to/" + link.toAirportId,
	    	    contentType: 'application/json; charset=utf-8',
	    	    dataType: 'json',
	    	    success: function(linkConsumptions) {
	    	    	$("#linkCompetitons .data-row").remove()
	    	    	$.each(linkConsumptions, function(index, linkConsumption) {
    	    			var row = $("<div class='table-row data-row'><div style='display: table-cell;'>" + linkConsumption.airlineName
                                  		    	    				+ "</div><div style='display: table-cell;'>" + toLinkClassValueString(linkConsumption.price, "$")
                                  		    	    				+ "</div><div style='display: table-cell; text-align: right;'>" + toLinkClassValueString(linkConsumption.capacity)
                                  		    	    				+ "</div><div style='display: table-cell; text-align: right;'>" + linkConsumption.quality
                                  		    	    				+ "</div><div style='display: table-cell; text-align: right;'>" + linkConsumption.frequency + "</div></div>")

                        if (linkConsumption.airlineId == airlineId) {
                            $("#linkCompetitons .table-header").after(row) //self is always on top
                        } else {
                            $("#linkCompetitons").append(row)
                        }

	    	    	})
	    	    	if ($("#linkCompetitons .data-row").length == 0) {
	    	    		$("#linkCompetitons").append("<div class='table-row data-row'><div style='display: table-cell;'>-</div><div style='display: table-cell;'>-</div><div style='display: table-cell;'>-</div><div style='display: table-cell;'>-</div></div>")
	    	    	}
	    	    	$("#linkCompetitons").show()
	    	    	
	    	    	assignAirlineColors(linkConsumptions, "airlineId")
	    	    	plotPie(linkConsumptions, null, $("#linkCompetitionsPie"), "airlineName", "soldSeats")
	    	    },
	            error: function(jqXHR, textStatus, errorThrown) {
	    	            console.log(JSON.stringify(jqXHR));
	    	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    	    }
	    	});
	    	
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
	//load history
	$.ajax({
		type: 'GET',
		url: "airlines/" + airlineId + "/link-consumptions/" + linkId + "?cycleCount=30",
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(linkConsumptions) {
	    	if (jQuery.isEmptyObject(linkConsumptions)) {
	    		$("#linkHistoryPrice").text("-")
		    	$("#linkHistoryCapacity").text("-")
		    	$("#linkLoadFactor").text("-")
		    	$("#linkProfit").text("-")
		    	$("#linkRevenue").text("-")
		    	$("#linkFuelCost").text("-")
		    	$("#linkCrewCost").text("-")
		    	$("#linkAirportFees").text("-")
		    	$("#linkDepreciation").text("-")
		    	$("#linkCompensation").text("-")
		    	$("#linkLoungeCost").text("-")
		    	$("#linkServiceSupplies").text("-")
		    	$("#linkMaintenance").text("-")
		    	$("#linkOtherCosts").text("-")
		    	$("#linkDelays").text("-")
		    	$("#linkCancellations").text("-")

		    	disableButton($("#linkDetails .button.viewLinkHistory"), "Passenger Map is not yet available for this route - please wait for the simulation (time estimation on top left of the screen).")
	    	} else {
	    		var linkConsumption = linkConsumptions[0]
	    		$("#linkHistoryPrice").text(toLinkClassValueString(linkConsumption.price, "$"))
		    	$("#linkHistoryCapacity").text(toLinkClassValueString(linkConsumption.capacity))
		    	
		    	var loadFactor = {}
		    	loadFactor.economy = "-"
		    	if (linkConsumption.capacity.economy > 0)  { loadFactor.economy = parseInt(linkConsumption.soldSeats.economy / linkConsumption.capacity.economy * 100)}
	    		loadFactor.business = "-"
			    if (linkConsumption.capacity.business > 0)  { loadFactor.business = parseInt(linkConsumption.soldSeats.business / linkConsumption.capacity.business * 100)}
	    		loadFactor.first = "-"
				if (linkConsumption.capacity.first > 0)  { loadFactor.first = parseInt(linkConsumption.soldSeats.first / linkConsumption.capacity.first * 100)}
		    	
	    		$("#linkLoadFactor").text(toLinkClassValueString(loadFactor, "", "%"))
		    	$("#linkProfit").text("$" + commaSeparateNumber(linkConsumption.profit))
		    	$("#linkRevenue").text("$" + commaSeparateNumber(linkConsumption.revenue))
		    	$("#linkFuelCost").text("$" + commaSeparateNumber(linkConsumption.fuelCost))
		    	$("#linkCrewCost").text("$" + commaSeparateNumber(linkConsumption.crewCost))
		    	$("#linkAirportFees").text("$" + commaSeparateNumber(linkConsumption.airportFees))
		    	$("#linkDepreciation").text("$" + commaSeparateNumber(linkConsumption.depreciation))
		    	$("#linkCompensation").text("$" + commaSeparateNumber(linkConsumption.delayCompensation))
		    	$("#linkLoungeCost").text("$" + commaSeparateNumber(linkConsumption.loungeCost))
		    	$("#linkServiceSupplies").text("$" + commaSeparateNumber(linkConsumption.inflightCost))
		    	$("#linkMaintenance").text("$" + commaSeparateNumber(linkConsumption.maintenanceCost))
		    	if (linkConsumption.minorDelayCount == 0 && linkConsumption.majorDelayCount == 0) {
		    		$("#linkDelays").removeClass("warning")
		    		$("#linkDelays").text("-")
		    	} else {
		    		$("#linkDelays").addClass("warning")
		    		$("#linkDelays").text(linkConsumption.minorDelayCount + " minor " + linkConsumption.majorDelayCount + " major")
		    	}
	    		
	    		if (linkConsumption.cancellationCount == 0) {
		    		$("#linkCancellations").removeClass("warning")
		    		$("#linkCancellations").text("-")
		    	} else {
		    		$("#linkCancellations").addClass("warning")
		    		$("#linkCancellations").text(linkConsumption.cancellationCount)
		    	}
		    	enableButton($("#linkDetails .button.viewLinkHistory"))
	    	}
	    	plotLinkProfit(linkConsumptions, $("#linkProfitChart"))
	    	plotLinkConsumption(linkConsumptions, $("#linkRidershipChart"), $("#linkRevenueChart"), $("#linkPriceChart"))
	    	$("#linkHistoryDetails").show()
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
	setActiveDiv($("#linkDetails"))
	hideActiveDiv($("#extendedPanel #airplaneModelDetails"))
	$('#sidePanel').fadeIn(200);
	
}

function editLink(linkId) {
	$.ajax({
		type: 'GET',
		url: "airlines/" + activeAirline.id + "/links/" + linkId,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(link) {
	    	planLink(link.fromAirportId, link.toAirportId)
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}

function fadeOutMarker(marker, animationInterval) {
    var opacity = 1.0
    var animation = window.setInterval(function () {
        if (opacity <= 0) {
            marker.setMap(null)
            marker.setOpacity(1)
            window.clearInterval(animation)
        } else {
            marker.setOpacity(opacity)
            opacity -= 0.1
        }
    }, animationInterval)
}


function planToAirport(toAirportId, toAirportName) {
	$('#planLinkToAirportId').val(toAirportId)
	//$('#planLinkToAirportName').text(toAirportName)
	
	if (!$('#planLinkFromAirportId').val()) { //set the HQ by default for now
		$('#planLinkFromAirportId').val(activeAirline.headquarterAirport.airportId)
		//$('#planLinkFromAirportName').text(activeAirline.headquarterAirport.airportName)
	}
	if ($('#planLinkFromAirportId').val() && $('#planLinkToAirportId').val()) {
		planLink($('#planLinkFromAirportId').val(), $('#planLinkToAirportId').val())
	}
}

function planLink(fromAirport, toAirport) {
	var airlineId = activeAirline.id
	$("#planLinkFromAirportId").val(fromAirport)
	$("#planLinkToAirportId").val(toAirport)
	
	if (fromAirport && toAirport) {
		setActiveDiv($('#planLinkDetails'))
		$('#sidePanel').fadeOut(200, function() {
		var url = "airlines/" + airlineId + "/plan-link"
			$.ajax({
				type: 'POST',
				url: url,
				data: { 'airlineId' : parseInt(airlineId), 'fromAirportId': parseInt(fromAirport), 'toAirportId' : parseInt(toAirport)} ,
	//			contentType: 'application/json; charset=utf-8',
				dataType: 'json',
			    success: function(linkInfo) {
			    	updatePlanLinkInfo(linkInfo)
			    	$('#sidePanel').fadeIn(200);
			    },
		        error: function(jqXHR, textStatus, errorThrown) {
			            console.log(JSON.stringify(jqXHR));
			            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
			    }
			});
		//hide existing info
		//$("#planLinkDetails div.value").hide()
		});
	}
	
	
}

var planLinkInfo = null
var planLinkInfoByModel = {}
var spaceMultipliers = null
//var existingLinkModelId = 0

function updatePlanLinkInfo(linkInfo) {
	var availableFromSlot = linkInfo.maxFrequencyFromAirport
	var availableToSlot = linkInfo.maxFrequencyToAirport
	if (linkInfo.existingLink) {
	    if (linkInfo.existingLink.future) {
	        availableFromSlot -= linkInfo.existingLink.future.frequency
            availableToSlot -= linkInfo.existingLink.future.frequency
	    } else {
            availableFromSlot -= linkInfo.existingLink.frequency
            availableToSlot -= linkInfo.existingLink.frequency
        }
	}
	var availableFromSlotText
	if (availableFromSlot == 0) {
		availableFromSlotText = '<span class="warning">' + availableFromSlot + ' available slot(s)</span>'
	} else {
		availableFromSlotText = '<span>' + availableFromSlot + ' available slot(s)</span>'
	}
	
	var availableToSlotText
	if (availableToSlot == 0) {
		availableToSlotText = '<span class="warning">' + availableToSlot + ' available slot(s)</span>'
	} else {
		availableToSlotText = '<span>' + availableToSlot + ' available slot(s)</span>'
	}
	
	$('#planLinkFromAirportName').attr("onclick", "showAirportDetails(" + linkInfo.fromAirportId + ")").html(getCountryFlagImg(linkInfo.fromCountryCode) + getAirportText(linkInfo.fromAirportCity, linkInfo.fromAirportCode) + '&nbsp;' + availableFromSlotText)
	if (activeAirline.baseAirports.length > 1) { //only allow changing from airport if this is a new link and there are more than 1 base
		$('#planLinkFromAirportEditIcon').show()
		//fill the from list
		$('#planLinkFromAirportSelect').empty()
		$.each(activeAirline.baseAirports, function(index, base) {
			var airportId = base.airportId
			var cityName = base.city
			var airportCode = base.airportCode
			var option = $("<option></option>").attr("value", airportId).text(getAirportText(cityName, airportCode))
			
			if ($('#planLinkFromAirportId').val() == airportId) {
				option.prop("selected", true)
			}
			option.appendTo($("#planLinkFromAirportSelect"))
		});
	} else {
		$('#planLinkFromAirportEditIcon').hide()
	}
	$("#planLinkFromAirportSelect").hide() //do not show the list yet
	//$('#planLinkFromAirportExpectedQuality').attr("onclick", "loadLinkExpectedQuality(" + linkInfo.fromAirportId + "," + linkInfo.toAirportId + "," + linkInfo.fromAirportId + ")")
	
	$('#planLinkToAirportName').attr("onclick", "showAirportDetails(" + linkInfo.toAirportId + ")").html(getCountryFlagImg(linkInfo.toCountryCode) + getAirportText(linkInfo.toAirportCity, linkInfo.toAirportCode) + '&nbsp;' + availableToSlotText)
	//$('#planLinkToAirportExpectedQuality').attr("onclick", "loadLinkExpectedQuality(" + linkInfo.fromAirportId + "," + linkInfo.toAirportId + "," + linkInfo.toAirportId + ")")
	$('#planLinkFlightCode').text(linkInfo.flightCode)
	$('#planLinkMutualRelationship').text(getRelationshipDescription(linkInfo.mutualRelationship))
	
	$('#planLinkDistance').text(linkInfo.distance + " km")
	$('#planLinkDirectDemand').text(toLinkClassValueString(linkInfo.directDemand) + " (business: " + linkInfo.businessPassengers + " tourist: " + linkInfo.touristPassengers + ")")
	//$('#planLinkAirportLinkCapacity').text(linkInfo.airportLinkCapacity)
	
	
	$("#planLinkCompetitons .data-row").remove()
	$.each(linkInfo.otherLinks, function(index, linkConsumption) {
		if (linkConsumption.airlineId != activeAirline.id) {
			$("#planLinkCompetitons").append("<div class='table-row data-row'><div style='display: table-cell;'>" + linkConsumption.airlineName
				    	    			   + "</div><div style='display: table-cell;'>" + toLinkClassValueString(linkConsumption.price, "$")
				    	    			   + "</div><div style='display: table-cell; text-align:right;'>" + toLinkClassValueString(linkConsumption.capacity)
				    	    			   + "</div><div style='display: table-cell; text-align:right;'>" + linkConsumption.quality
				    	    			   + "</div><div style='display: table-cell; text-align:right;'>" + linkConsumption.frequency + "</div></div>")
		}			
	})
	if ($("#planLinkCompetitons .data-row").length == 0) {
		$("#planLinkCompetitons").append("<div class='table-row data-row'><div style='display: table-cell;'>-</div><div style='display: table-cell;'>-</div><div style='display: table-cell;'>-</div><div style='display: table-cell;'>-</div></div>")
	}
	
	if (tempPath) { //remove previous plan link if it exists
		removeTempPath()
	}
	
	$('#planLinkCost').text('$' + commaSeparateNumber(linkInfo.cost))
    
	//unhighlight the existing path if any
	if (selectedLink) {
		unhighlightLink(selectedLink)
	}
	
	if (!linkInfo.existingLink) { //new link
		//create a temp path
		var tempLink = {fromLatitude : linkInfo.fromAirportLatitude, fromLongitude : linkInfo.fromAirportLongitude, toLatitude : linkInfo.toAirportLatitude, toLongitude : linkInfo.toAirportLongitude}
		//set the temp path
		tempPath = drawFlightPath(tempLink, '#2658d3')
		highlightPath(tempPath.path, false)
	} else {
		//selectLinkFromMap(linkInfo.existingLink.id, true)
		highlightLink(linkInfo.existingLink.id, false)
	}
	
	if (linkInfo.rejection) {
		$('#linkRejectionRow #linkRejectionReason').text(linkInfo.rejection)
		$('#linkRejectionRow').show()
		$('#addLinkButton').hide()
		$('#updateLinkButton').hide()
		$('#deleteLinkButton').hide()
		$('#planLinkExtendedDetails').hide()
		$('#planLinkModelRow').hide()
		$('#extendedPanel').hide()
		return
	} else {
		$('#linkRejectionRow').hide()
		$('#planLinkModelRow').show()
	}

	if (!linkInfo.existingLink) {
		$('#planLinkEconomyPrice').val(linkInfo.suggestedPrice.economy)
		$('#planLinkBusinessPrice').val(linkInfo.suggestedPrice.business)
		$('#planLinkFirstPrice').val(linkInfo.suggestedPrice.first)
		$('#addLinkButton').show()
		$('#deleteLinkButton').hide()
		$('#updateLinkButton').hide()
	} else {
		$('#planLinkEconomyPrice').val(linkInfo.existingLink.price.economy)
		$('#planLinkBusinessPrice').val(linkInfo.existingLink.price.business)
		$('#planLinkFirstPrice').val(linkInfo.existingLink.price.first)
		$('#addLinkButton').hide()
		if (linkInfo.deleteRejection) {
			$('#deleteLinkButton').hide()
		} else {
			$('#deleteLinkButton').show()
		}
		$('#updateLinkButton').show()
	}

    //reset/display warnings
    $("#planLinkDetails .warningList").empty()
    if (linkInfo.warnings) {
        $.each(linkInfo.warnings, function(index, warning) {
            $("#planLinkDetails .warningList").append("<div class='warning'><img src='assets/images/icons/exclamation-red-frame.png'>&nbsp;" + warning + "</div>")
        })
    }

	
	//populate airplane model drop down
	var explicitlySelectedModelId = $("#planLinkModelSelect").data('explicitId')
	$("#planLinkModelSelect").removeData('explicitId')
	$("#planLinkModelSelect").children('option').remove()

	planLinkInfo = linkInfo
	spaceMultipliers = {
                economy : planLinkInfo.economySpaceMultiplier,
                business : planLinkInfo.businessSpaceMultiplier,
                first : planLinkInfo.firstSpaceMultiplier
    }

	planLinkInfoByModel = {}
	//existingLinkModelId = 0

	//find which model is assigned to the existing link (if exist)
	var assignedModelId
	var selectedModelId
	
	if (explicitlySelectedModelId) { //if there was a explicitly selected model, for example from buying a new plane
		selectedModelId = explicitlySelectedModelId;
	}
	
	if (linkInfo.existingLink) {
		$.each(linkInfo.modelPlanLinkInfo, function(key, modelPlanLinkInfo) {
			if (modelPlanLinkInfo.isAssigned) { //higher precedence
				assignedModelId = modelPlanLinkInfo.modelId
				if (!selectedModelId) {
					selectedModelId = assignedModelId
				}
				return false
			}
		});
	}
	
	if (!selectedModelId) {
		$.each(linkInfo.modelPlanLinkInfo, function(key, modelPlanLinkInfo) {
			if (modelPlanLinkInfo.airplanes.length > 0) { //select the first one with available planes
				selectedModelId = modelPlanLinkInfo.modelId
				return false
			}  
		})
	}
	
	$.each(linkInfo.modelPlanLinkInfo, function(key, modelPlanLinkInfo) {
		if (modelPlanLinkInfo.airplanes.length > 0) {
			modelPlanLinkInfo.owned = true
		} else {
			modelPlanLinkInfo.owned = false
		}
	})
	
	linkInfo.modelPlanLinkInfo = sortPreserveOrder(linkInfo.modelPlanLinkInfo, "capacity", true)
	linkInfo.modelPlanLinkInfo = sortPreserveOrder(linkInfo.modelPlanLinkInfo, "owned", false)
	
	if (!selectedModelId) { //nothing available, select the first one in the list
		if (linkInfo.modelPlanLinkInfo.length > 0) { //select the first one with available planes
			selectedModelId = linkInfo.modelPlanLinkInfo[0].modelId
		}
	}
	
	$.each(linkInfo.modelPlanLinkInfo, function(key, modelPlanLinkInfo) {
		var modelId = modelPlanLinkInfo.modelId
		var modelname = modelPlanLinkInfo.modelName
		
		var option = $("<option></option>").attr("value", modelId).text(modelname + " (" + modelPlanLinkInfo.airplanes.length + ")")
		option.appendTo($("#planLinkModelSelect"))
		
		if (selectedModelId == modelId) {
			option.prop("selected", true)
			updateModelInfo(modelId)
		}
		
		planLinkInfoByModel[modelId] = modelPlanLinkInfo
	});
	
	if (linkInfo.modelPlanLinkInfo.length == 0) {
		$("#planLinkModelSelect").next($(".warning")).remove()
		$("#planLinkModelSelect").after("<span class='label warning'>No airplane model can fly to this destination</span>")
		$("#planLinkModelSelect").hide()
		
		hideActiveDiv($("#extendedPanel #airplaneModelDetails"))
	} else {
		$("#planLinkModelSelect").next($(".warning")).remove()
		$("#planLinkModelSelect").show()
		
		setActiveDiv($("#extendedPanel #airplaneModelDetails"))
	}
	
	updatePlanLinkInfoWithModelSelected(selectedModelId, assignedModelId)
	$("#planLinkDetails div.value").show()
}

function resetPrice() {
	updatePrice(1)
}

function increasePrice() {
	var currentPrice = parseFloat($('#planLinkEconomyPrice').val()) * 20
	var currentPercentage = Math.round(currentPrice / planLinkInfo.suggestedPrice.economy) / 20
	var newPercentage = currentPercentage + 0.05
	updatePrice(newPercentage)
	$('#planLinkPricePercentage').val(newPercentage)
}

function decreasePrice() {
	var currentPrice = parseFloat($('#planLinkEconomyPrice').val()) * 20
	var currentPercentage = Math.round(currentPrice / planLinkInfo.suggestedPrice.economy) / 20
	var newPercentage = currentPercentage
	if (currentPercentage > 0) {
		newPercentage -= 0.05
	}
	updatePrice(newPercentage)
	
	$('#planLinkPricePercentage').val(newPercentage)
}

function updatePrice(percentage) {
	$('#planLinkEconomyPrice').val(Math.round(planLinkInfo.suggestedPrice.economy * percentage))
	$('#planLinkBusinessPrice').val(Math.round(planLinkInfo.suggestedPrice.business * percentage))
	$('#planLinkFirstPrice').val(Math.round(planLinkInfo.suggestedPrice.first * percentage))
}

function updateFrequencyBar(frequencyBar, valueContainer, airplane, currentFrequency) {
    var availableFrequency = Math.floor(airplane.availableFlightMinutes / planLinkInfoByModel[airplane.modelId].flightMinutesRequired)
    var maxFrequency = availableFrequency + currentFrequency
    if (currentFrequency == 0) { //set 1 as min
        valueContainer.val(1)
    }
    generateImageBar(frequencyBar.data("emptyIcon"), frequencyBar.data("fillIcon"), maxFrequency, frequencyBar, valueContainer, null, null, updateTotalValues)
}

function updatePlanLinkInfoWithModelSelected(newModelId, assignedModelId) {
    selectedModelId = newModelId //modify the global one
	if (selectedModelId) {
		var thisModelPlanLinkInfo = planLinkInfoByModel[selectedModelId]
		
		$('#planLinkAirplaneSelect').empty()
		
		thisModelPlanLinkInfo.airplanes.sort(sortByProperty('airplane.condition', true))
		thisModelPlanLinkInfo.airplanes = sortPreserveOrder(thisModelPlanLinkInfo.airplanes, 'frequency', false) //higher frequency first
		
		
		$('#planLinkAirplaneSelect').data('badConditionThreshold', thisModelPlanLinkInfo.badConditionThreshold)
		thisModelPlanLinkInfo.airplanes.sort(function(a, b) {
		    var result = a.airplane.condition - b.airplane.condition //lowest condition ones first
		    if (result == 0) {
		        return b.airplane.frequency - a.airplane.frequency //highest frequency first
		    } else {
		        return result
		    }
		})
		$.each(thisModelPlanLinkInfo.airplanes, function(key, airplaneEntry) {
//			var option = $("<option></option>").attr("value", airplane.airplaneId).text("#" + airplane.airplaneId)
//			option.appendTo($("#planLinkAirplaneSelect"))
			var airplane = airplaneEntry.airplane
			airplane.isAssigned = airplaneEntry.frequency >  0
			var div =  $('<div class="clickable airplaneButton" onclick="toggleAssignedAirplane(this)" style="float: left;"></div>')
			div.append(getAssignedAirplaneIcon(airplane))
			div.data('airplane', airplane)
			div.data('existingFrequency', airplaneEntry.frequency)

			$('#planLinkAirplaneSelect').append(div)
		})
		if (thisModelPlanLinkInfo.airplanes.length == 0) {
		    $('#planLinkDetails .noAirplaneHelp').show()
		} else {
		    $('#planLinkDetails .noAirplaneHelp').hide()
		}
		toggleUtilizationRate($('#planLinkAirplaneSelect'), $('#planLinkExtendedDetails .toggleUtilizationRateBox'))


		$('#planLinkDuration').text(getDurationText(thisModelPlanLinkInfo.duration))
		
		var existingLink = planLinkInfo.existingLink
		
		if (existingLink) {
			$("#planLinkServiceLevel").val(existingLink.rawQuality / 20)
		} else {
			$("#planLinkServiceLevel").val(1)
		}
	
		updateFrequencyDetail(thisModelPlanLinkInfo)

		var serviceLevelBar = $("#serviceLevelBar")
		generateImageBar(serviceLevelBar.data("emptyIcon"), serviceLevelBar.data("fillIcon"), 5, serviceLevelBar, $("#planLinkServiceLevel"))
		$("#planLinkExtendedDetails").show()
	} else {
		$("#planLinkExtendedDetails").hide()
	}
}

function updateFrequencyDetail(info) {
    var airplaneEntries = info.airplanes
    $("#planLinkDetails .frequencyDetail .table-row").remove()

    var isEmpty = true
    $.each(airplaneEntries, function(index, airplaneEntry) {
        if (airplaneEntry.frequency > 0) { //only draw for those that are assigned to this link
            addAirplaneRow($("#planLinkDetails .frequencyDetail"), airplaneEntry.airplane, airplaneEntry.frequency)
            isEmpty = false
        }
    })
    if (isEmpty) {
        $("#planLinkDetails .frequencyDetail").append("<div class='table-row empty'><div class='cell'></div><div class='cell'>-</div><div class='cell'>-</div></div>")
    }

    updateLimit()
    updateTotalValues()
}

function updateLimit() {
	var maxFrequencyFromAirport = planLinkInfo.maxFrequencyFromAirport
	var maxFrequencyToAirport = planLinkInfo.maxFrequencyToAirport
	var maxFrequency = planLinkInfo.maxFrequencyAbsolute
	$('#planLinkDetails .planLinkLimitDiv .maxFrequencyFromAirport').text(maxFrequencyFromAirport)
	$('#planLinkDetails .planLinkLimitDiv .maxFrequencyToAirport').text(maxFrequencyToAirport)
	$('#planLinkDetails .planLinkLimitDiv .maxFrequencyAbsolute').text(planLinkInfo.maxFrequencyAbsolute)

	var limitingFactor = "Max frequency for route"
	if (maxFrequencyFromAirport < maxFrequency) { //limited by from airport
		maxFrequency = maxFrequencyFromAirport
		limitingFactor = "Max slots offered by " + planLinkInfo.fromAirportName
	}

	if (maxFrequencyToAirport < maxFrequency) { //limited by to airport
		maxFrequency = maxFrequencyToAirport
		limitingFactor = "Max slots offered by " + planLinkInfo.toAirportName
	}

	$("#planLinkDetails .planLinkLimitDiv .limitingFactor").text(limitingFactor)
	$("#planLinkDetails .frequencyLimit").text(maxFrequency)
	$("#planLinkDetails").data('frequencyLimit', maxFrequency)
}

function addAirplaneRow(container, airplane, frequency) {
    var airplaneRow = $("<div class='table-row airplaneRow'></div>") //airplane bar contains - airplane icon, configuration, frequency

    var configurationDiv = $("<div class='configuration' style='transform: translate(0%, -75%);'></div>")
    var airplaneUpdateCallback = function(configurationDiv, airplaneId) {
        return function() {
            $.ajax({
                    type: 'GET',
                    url: "airlines/" + activeAirline.id + "/airplanes/" + airplaneId,
                    contentType: 'application/json; charset=utf-8',
                    dataType: 'json',
                    success: function(result) {
                        var updatedAirplane = result
                        //should not redraw the whole airplaneRow as the unsaved frequency change will be reverted
                        plotSeatConfigurationBar(configurationDiv, updatedAirplane.configuration, updatedAirplane.capacity, spaceMultipliers, true, "10px")
                        airplaneRow.data("airplane", updatedAirplane)
                        updateTotalValues()
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                            console.log(JSON.stringify(jqXHR));
                            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
                    }
                });
        }
    }

    var airplaneCellOuter = $('<div class="cell"></div>')
    var airplaneCell = $("<div style='display: flex; align-items: center;'></div>")
    airplaneCellOuter.append(airplaneCell)

    var onclickFunction = 'loadOwnedAirplaneDetails(' + airplane.id + ', null, $(this).data(\'airplaneUpdateCallback\'), true)'
    var airplaneInspectIcon = $('<div class="clickable-no-highlight" onclick="' + onclickFunction + '" style="display: inline-block; margin-left: 1px; margin-right: 1px;"></div>')
    airplaneInspectIcon.data("airplaneUpdateCallback", airplaneUpdateCallback(configurationDiv, airplane.id))
    airplaneInspectIcon.append($('<img src="assets/images/icons/airplane-magnifier.png" title="Inspect airplane #' + airplane.id + '">'))
    airplaneCell.append(airplaneInspectIcon)

    var airplaneRemovalIcon = $('<div class="clickable-no-highlight" onclick="removeAirplaneFromLink(' + airplane.id + ')" style="display: inline-block; margin-left: 1px; margin-right: 1px;"></div>')
    airplaneRemovalIcon.append($('<img src="assets/images/icons/airplane-minus.png" title="Unassign airplane #' + airplane.id + '">'))
    airplaneCell.append(airplaneRemovalIcon)

    airplaneCell.append($("<span>#" + airplane.id + "</span>"))

    var sharedLinkCount = 0
    $.each(airplane.linkAssignments, function(linkId, frequency) {
        if (linkId != selectedLink) {
            sharedLinkCount ++
        }
    })
    if (sharedLinkCount > 0) {
        airplaneCell.append($('<img src="assets/images/icons/information.png" title="Shared with ' + sharedLinkCount + ' other route(s)">'))
    }

    if (!airplane.isReady) {
        airplaneCell.append($('<img src="assets/images/icons/construction.png" title="Under construction">'))
    }

    airplaneRow.append(airplaneCellOuter)


    var configurationCell = $("<div class='cell'></div>")
    configurationCell.append(configurationDiv)
    airplaneRow.append(configurationCell)

    var frequencyBar = $("<div class='frequencyBar cell' data-empty-icon='assets/images/icons/round-dot-grey.png' data-fill-icon='assets/images/icons/round-dot-green.png'></div>")
    airplaneRow.append(frequencyBar)

    var valueContainer = $("<input class='frequency' type='hidden'>") //so changing the frequency bar would write the new value back to this ...is this necessary? since there's a callback function now...
    valueContainer.val(frequency)
    airplaneRow.append(valueContainer)
    airplaneRow.data("airplane", airplane)

    container.append(airplaneRow)
    updateFrequencyBar(frequencyBar, valueContainer, airplane, frequency)
    plotSeatConfigurationBar(configurationDiv, airplane.configuration, airplane.capacity, spaceMultipliers, true, "10px")
}

function addAirplaneToLink(airplane, frequency) {
    $("#planLinkDetails .frequencyDetail .table-row.empty").remove()
    addAirplaneRow($("#planLinkDetails .frequencyDetail"), airplane, frequency)
    updateTotalValues()
}

function removeAirplaneFromLink(airplaneId) {
    $("#planLinkDetails .frequencyDetail .airplaneRow").each(function(index, row){
        if ($(row).data("airplane").id == airplaneId) {
            $(row).remove()
        }
    })
    if ($("#planLinkDetails .frequencyDetail .airplaneRow").length == 0) {
        $("#planLinkDetails .frequencyDetail").append("<div class='table-row empty'><div class='cell'></div><div class='cell'>-</div><div class='cell'>-</div></div>")
    }

    updateTotalValues()

    //update the available airplane list
    $('#planLinkAirplaneSelect .airplaneButton').each(function(index, airplaneIcon){
      var airplane = $(airplaneIcon).data('airplane')
      if (airplane.id == airplaneId) {
        airplane.isAssigned = false
        $(airplaneIcon).find('img').replaceWith(getAssignedAirplaneIcon(airplane))
      }
    })
}


// Update total frequency and capacity
function updateTotalValues() {
    var currentCapacity = { "economy" : 0, "business" : 0, "first" : 0}
    var futureFrequency = 0
    var futureCapacity = { "economy" : 0, "business" : 0, "first" : 0}
    var hasUnderConstructionAirplanes = false
    $("#planLinkDetails .frequencyDetail .airplaneRow").each(function(index, airplaneRow) {
       frequency = parseInt($(airplaneRow).find(".frequency").val())
       configuration = $(airplaneRow).data("airplane").configuration

       futureFrequency += frequency
       futureCapacity.economy += configuration.economy * frequency
       futureCapacity.business += configuration.business * frequency
       futureCapacity.first += configuration.first * frequency

       if ($(airplaneRow).data("airplane").isReady) {
           currentCapacity.economy += configuration.economy * frequency
           currentCapacity.business += configuration.business * frequency
           currentCapacity.first += configuration.first * frequency
       } else {
            hasUnderConstructionAirplanes = true
       }
    })
    $(".frequencyDetailTotal .total").text(futureFrequency)

    $('#planLinkCapacity').text(toLinkClassValueString(currentCapacity))
    if (hasUnderConstructionAirplanes) {
        $("#planLinkDetails .future .capacity").text(toLinkClassValueString(futureCapacity))
        $("#planLinkDetails .future").show()
    } else {
        $("#planLinkDetails .future").hide()
    }

    var frequencyLimit = $("#planLinkDetails").data("frequencyLimit")
    if (frequencyLimit < futureFrequency) { //warning
        $(".frequencyDetailTotal .fatal").show();
        disableButton($("#planLinkDetails .updateLinkButton"), "Flight frequency exceeding limit")
    } else {
        $(".frequencyDetailTotal .fatal").hide();
        enableButton($("#planLinkDetails .updateLinkButton"))
    }

    if (futureFrequency == 0) {
        disableButton($("#planLinkDetails .updateLinkButton"), "Must assign airplanes and frequency")
    } else {
        enableButton($("#planLinkDetails .updateLinkButton"))
    }
}


function getAssignedAirplaneIcon(airplane) {
	var badConditionThreshold = $('#planLinkAirplaneSelect').data('badConditionThreshold')
	return getAirplaneIcon(airplane, badConditionThreshold, airplane.isAssigned)
}


function toggleAssignedAirplane(iconSpan) {
	var airplane = $(iconSpan).data('airplane')
	var existingFrequency =  $(iconSpan).data('existingFrequency')
	if (airplane.isAssigned) {
		airplane.isAssigned = false
	} else {
		airplane.isAssigned = true
	}
	$(iconSpan).find('img').replaceWith(getAssignedAirplaneIcon(airplane))

	if (airplane.isAssigned) { //add to the airplane frequency detail
        addAirplaneToLink(airplane, existingFrequency)
	} else { //remove from the airplane frequency detail
	    removeAirplaneFromLink(airplane.id)
	}
}

function getAssignedAirplaneFrequencies() {
	var assignedAirplaneFrequencies = {} //key airplaneId, value frequeuncy
	$('#planLinkDetails .frequencyDetail').find('.airplaneRow').each(function(index, airplaneRow) {
		var airplane = $(airplaneRow).data("airplane")
        assignedAirplaneFrequencies[airplane.id] = parseInt($(airplaneRow).find('.frequency').val())
	})
	
	return assignedAirplaneFrequencies
}

function createLink() {
	if ($("#planLinkFromAirportId").val() && $("#planLinkToAirportId").val()) {
		var airlineId = activeAirline.id
		var url = "airlines/" + airlineId + "/links"
	    //console.log("selected " + $("#planLinkAirplaneSelect").val())
	    var configuration = planLinkInfoByModel[$("#planLinkModelSelect").val()].configuration
	    var linkData = { 
			"fromAirportId" : parseInt($("#planLinkFromAirportId").val()), 
			"toAirportId" : parseInt($("#planLinkToAirportId").val()),
			//"airplanes" : $("#planLinkAirplaneSelect").val().map(Number),
			airplanes : getAssignedAirplaneFrequencies(),
			"airlineId" : airlineId,
			//"configuration" : { "economy" : configuration.economy, "business" : configuration.business, "first" : configuration.first},
			"price" : { "economy" : parseInt($("#planLinkEconomyPrice").val()), "business" : parseInt($("#planLinkBusinessPrice").val()), "first" : parseInt($("#planLinkFirstPrice").val())},
			//"frequency" : parseInt($("#planLinkFrequency").val()),
			"model" : parseInt($("#planLinkModelSelect").val()),
			"rawQuality" : parseInt($("#planLinkServiceLevel").val()) * 20}
		$.ajax({
			type: 'PUT',
			url: url,
		    data: JSON.stringify(linkData),
		    contentType: 'application/json; charset=utf-8',
		    dataType: 'json',
		    success: function(savedLink) {
		    	if (savedLink.id) {
		    		if (!flightPaths[savedLink.id]) { //new link
		    			//remove temp path
		    			removeTempPath()
		    			//draw flight path
		    			var newPath = drawFlightPath(savedLink)
		    			selectLinkFromMap(savedLink.id, false)
		    			refreshPanels(airlineId) //refresh panels would update link details
		    		} else {
		    			refreshLinkDetails(savedLink.id)
		    		}
		    		
			    	
		    		setActiveDiv($('#linkDetails'))
		    		hideActiveDiv($('#extendedPanel #airplaneModelDetails'))
		    				    				    		
		    		if ($('#linksCanvas').is(':visible')) { //reload the links table then
		    			loadLinksTable()
		    		}
		    	}
		    },
	        error: function(jqXHR, textStatus, errorThrown) {
		            console.log(JSON.stringify(jqXHR));
		            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
		    }
		});
	}
}

function deleteLink() {
	var linkId = $('#actionLinkId').val()
	$.ajax({
		type: 'DELETE',
		url: "airlines/" + activeAirline.id + "/links/" + linkId,
	    success: function() {
	    	$("#linkDetails").fadeOut(200)
	    	updateLinksInfo()
	    	deselectLink()
	    	
	    	if ($('#linksCanvas').is(':visible')) { //reload the links table then
		    	loadLinksTable()
    		}
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}

function cancelPlanLink() {
	//remove the temp path
	if (tempPath) { //create new link
		removeTempPath()
		//hideActiveDiv($('#planLinkDetails'))
		$('#sidePanel').fadeOut(200) //hide the whole side panel
	} else { //simply go back to linkDetails of the current link (exit edit mode)
		setActiveDiv($('#linkDetails'))
	}
	hideActiveDiv($("#extendedPanel #airplaneModelDetails"))
}

function removeTempPath() {
	if (tempPath) {
		unhighlightPath(tempPath.path)
		clearPathEntry(tempPath)
		tempPath = undefined
	}
}

function showLinksDetails() {
	selectedLink = undefined
	loadLinksTable()
	setActiveDiv($('#linksCanvas'));
	highlightTab($('.linksCanvasTab'))
	$('#sidePanel').fadeOut(200);
	$('#sidePanel').appendTo($('#linksCanvas'))
}

function loadLinksTable() {
	var url = "airlines/" + activeAirline.id + "/links?getProfit=true"
	$.ajax({
		type: 'GET',
		url: url,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(links) {
	    	updateLoadedLinks(links);
	    	$.each(links, function(key, link) {
				link.totalCapacity = link.capacity.economy + link.capacity.business + link.capacity.first
				link.totalPassengers = link.passengers.economy + link.passengers.business + link.passengers.first
				link.totalLoadFactor = link.totalCapacity > 0 ? Math.round(link.totalPassengers / link.totalCapacity * 100) : 0
				var assignedModel 
				if (link.assignedAirplanes && link.assignedAirplanes.length > 0) {
					assignedModel = link.assignedAirplanes[0].airplane.name
				} else {
					assignedModel = "-"
				}
				link.model = assignedModel //so this can be sorted
			})
	    	
			var selectedSortHeader = $('#linksTableSortHeader .cell.selected') 
		    updateLinksTable(selectedSortHeader.data('sort-property'), selectedSortHeader.data('sort-order'))
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}

function toggleLinksTableSortOrder(sortHeader) {
	if (sortHeader.data("sort-order") == "ascending") {
		sortHeader.data("sort-order", "descending")
	} else {
		sortHeader.data("sort-order", "ascending")
	}
	
	sortHeader.siblings().removeClass("selected")
	sortHeader.addClass("selected")
	
	updateLinksTable(sortHeader.data("sort-property"), sortHeader.data("sort-order"))
}

function updateLinksTable(sortProperty, sortOrder) {
	var linksTable = $("#linksCanvas #linksTable")
	linksTable.children("div.table-row").remove()
	
	//sort the list
	//loadedLinks.sort(sortByProperty(sortProperty, sortOrder == "ascending"))
	loadedLinks = sortPreserveOrder(loadedLinks, sortProperty, sortOrder == "ascending")
	
	$.each(loadedLinks, function(index, link) {
		var row = $("<div class='table-row clickable' onclick='selectLinkFromTable($(this), " + link.id + ")'></div>")
		
		row.append("<div class='cell'>" + getCountryFlagImg(link.fromCountryCode) + getAirportText(link.fromAirportCity, link.fromAirportCode) + "</div>")
		row.append("<div class='cell'>" + getCountryFlagImg(link.toCountryCode) + getAirportText(link.toAirportCity, link.toAirportCode) + "</div>")
		row.append("<div class='cell'>" + link.model + "</div>")
		row.append("<div class='cell' align='right'>" + link.distance + "km</div>")
		row.append("<div class='cell' align='right'>" + link.totalCapacity + "(" + link.frequency + ")</div>")
		row.append("<div class='cell' align='right'>" + link.totalPassengers + "</div>")
		row.append("<div class='cell' align='right'>" + link.totalLoadFactor + '%' + "</div>")
		row.append("<div class='cell' align='right'>" + '$' + commaSeparateNumber(link.revenue) + "</div>")
		row.append("<div class='cell' align='right'>" + '$' + commaSeparateNumber(link.profit) + "</div>")
		
		if (selectedLink == link.id) {
			row.addClass("selected")
		}
		
		linksTable.append(row)
	});
}

function selectLinkFromMap(linkId, refocus) {
	refocus = refocus || false 
	unhighlightLink(selectedLink)
	selectedLink = linkId
	highlightLink(linkId, refocus)
	
	//update link details panel
	refreshLinkDetails(linkId)
}


function selectLinkFromTable(row, linkId) {
	selectedLink = linkId
	//update table
	row.siblings().removeClass("selected")
	row.addClass("selected")
	
	//update link details panel
	refreshLinkDetails(linkId)
}


	
//TEST METHODS

function removeAllLinks() {
	$.ajax({
		type: 'DELETE',
		url: "links",
	    success: function() {
	    	updateLinksInfo()
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}


function updateLoadedLinks(links) {
	var previousOrder = {}
	if (loadedLinks) {
		$.each(loadedLinks, function(index, link) {
			previousOrder[link.id] = index
		})
		$.each(links, function(index, link) {
			link.previousOrder = previousOrder[link.id]
		})
		loadedLinks = links;
		loadedLinks.sort(sortByProperty("previousOrder"), true)
	} else {
		loadedLinks = links;
	}
	
	
	loadedLinksById = {}
	$.each(links, function(index, link) {
		loadedLinksById[link.id] = link
	});
}

function showLinkExpectedQualityModal(isFromAirport) {
	var fromAirportId = $('#planLinkFromAirportId').val()
	var toAirportId = $('#planLinkToAirportId').val()
	var queryAirportId
	if (isFromAirport) {
		queryAirportId = fromAirportId
	} else {
		queryAirportId = toAirportId
	}
	var url = "airlines/" + activeAirline.id + "/expectedQuality/" + fromAirportId + "/" + toAirportId + "/" + queryAirportId
	$('#expectedQualityModal .expectedQualityValue').empty()
	$.ajax({
		type: 'GET',
		url: url,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(result) {
	    	$('#expectedQualityModal .expectedQualityValue.firstClass').html(getGradeStarsImgs(Math.round(result.F / 10)))
	    	$('#expectedQualityModal .expectedQualityValue.businessClass').html(getGradeStarsImgs(Math.round(result.J / 10)))
	    	$('#expectedQualityModal .expectedQualityValue.economyClass').html(getGradeStarsImgs(Math.round(result.Y / 10)))
	    	$('#expectedQualityModal').fadeIn(200)
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    }
	});
}

function showLinkComposition(linkId) {
	var url = "airlines/" + activeAirline.id + "/link-composition/" + linkId
	
	$.ajax({
		type: 'GET',
		url: url,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(result) {
	    	updateTopCountryComposition(result.country)
	    	updatePassengerTypeComposition(result.passengerType)
	    	updatePrefernceTypeComposition(result.preferenceType)
	    	plotPie(result.country, null , $("#passengerCompositionByCountryPie"), "countryName", "passengerCount")
	    	plotPie(result.passengerType, null , $("#passengerCompositionByPassengerTypePie"), "title", "passengerCount")
	    	plotPie(result.preferenceType, null , $("#passengerCompositionByPreferenceTypePie"), "title", "passengerCount")

	    	$('#linkCompositionModal').fadeIn(200)
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    },
	    beforeSend: function() {
	    	$('body .loadingSpinner').show()
	    },
	    complete: function(){
	    	$('body .loadingSpinner').hide()
	    }
	});
}

function showLinkRivalHistory(linkId) {
	var url = "airlines/" + activeAirline.id + "/link-rival-history/" + linkId + "?cycleCount=30"

	$.ajax({
		type: 'GET',
		url: url,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(result) {
	    	plotRivalHistoryChart(result.overlappingLinks, $("#rivalEconomyPriceChart"), "economy", "price", "$", activeAirline.id)
	    	plotRivalHistoryChart(result.overlappingLinks, $("#rivalBusinessPriceChart"), "business", "price", "$", activeAirline.id)
	    	plotRivalHistoryChart(result.overlappingLinks, $("#rivalFirstPriceChart"), "first", "price", "$", activeAirline.id)
	    	plotRivalHistoryChart(result.overlappingLinks, $("#rivalEconomyCapacityChart"), "economy", "capacity", "", activeAirline.id)
            plotRivalHistoryChart(result.overlappingLinks, $("#rivalBusinessCapacityChart"), "business", "capacity", "", activeAirline.id)
            plotRivalHistoryChart(result.overlappingLinks, $("#rivalFirstCapacityChart"), "first", "capacity", "", activeAirline.id)

	    	$('#linkRivalHistoryModal').fadeIn(200)
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    },
	    beforeSend: function() {
	    	$('body .loadingSpinner').show()
	    },
	    complete: function(){
	    	$('body .loadingSpinner').hide()
	    }
	});
}

function showLinkRivalDetails(linkId) {
	var url = "airlines/" + activeAirline.id + "/link-rival-details/" + linkId

	$.ajax({
		type: 'GET',
		url: url,
	    contentType: 'application/json; charset=utf-8',
	    dataType: 'json',
	    success: function(result) {
	        updateRivalTables(result)

	    	$('#linkRivalDetailsModal').fadeIn(200)
	    },
        error: function(jqXHR, textStatus, errorThrown) {
	            console.log(JSON.stringify(jqXHR));
	            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
	    },
	    beforeSend: function() {
	    	$('body .loadingSpinner').show()
	    },
	    complete: function(){
	    	$('body .loadingSpinner').hide()
	    }
	});
}

function updateRivalTables(result) {
    var loyaltyAwarenessTable = $("#rivalLoyaltyAwarenessTable")
    var networkCapacityTable = $("#networkCapacity")
    loyaltyAwarenessTable.children(".table-row").remove()
    networkCapacityTable.children(".table-row").remove()
	var fromAirportText = getAirportText(result.fromCity, result.fromAirportCode)
    var toAirportText = getAirportText(result.toCity, result.toAirportCode)
    $("#linkRivalDetailsModal .fromAirportText").text(fromAirportText)
    $("#linkRivalDetailsModal .toAirportText").text(toAirportText)


	var airlineNameById = {}
	var fromAirportLoyalty = {}
	var toAirportLoyalty = {}
	var fromAirportAwareness = {}
    var toAirportAwareness = {}
    var fromAirportCapacity = {}
    var toAirportCapacity = {}



    $.each(result.fromAirport, function(index, entry) {
	     var airlineId = entry.airline.id
	     airlineNameById[airlineId] = entry.airline.name
	     fromAirportAwareness[airlineId] = entry.awareness
	     fromAirportLoyalty[airlineId] = entry.loyalty
	     fromAirportCapacity[airlineId] = { "economy" : entry.network.economy, "business" : entry.network.business, "first" : entry.network.first}
     })

    $.each(result.toAirport, function(index, entry) {
         var airlineId = entry.airline.id
         toAirportAwareness[airlineId] = entry.awareness
         toAirportLoyalty[airlineId] = entry.loyalty
         toAirportCapacity[airlineId] = { "economy" : entry.network.economy, "business" : entry.network.business, "first" : entry.network.first}
    })


    var fullHeartSource = "assets/images/icons/heart.png"
    var halfHeartSource = "assets/images/icons/heart-half.png"
    var fullStarSource = "assets/images/icons/star.png"
    var halfStarSource = "assets/images/icons/star-half.png"
    var greenManSource = "assets/images/icons/man-green.png"
    var blueManSource = "assets/images/icons/man-blue.png"
    var yellowManSource = "assets/images/icons/man-yellow.png"
    $.each(airlineNameById, function(airlineId, airlineName) {
     	var row = $("<div class='table-row'></div>")
		row.append("<div class='cell' align='left'>" + getAirlineLogoImg(airlineId) + airlineName + "</div>")
		getHalfStepImageBarByValue(fullHeartSource, halfHeartSource, 10, fromAirportLoyalty[airlineId]).appendTo($("<div class='cell' align='right'></div>").appendTo(row))
		getHalfStepImageBarByValue(fullStarSource, halfStarSource, 10, fromAirportAwareness[airlineId]).appendTo($("<div class='cell' align='right'></div>").appendTo(row))
		getHalfStepImageBarByValue(fullHeartSource, halfHeartSource, 10, toAirportLoyalty[airlineId]).appendTo($("<div class='cell' align='right'></div>").appendTo(row))
		getHalfStepImageBarByValue(fullStarSource, halfStarSource, 10, toAirportAwareness[airlineId]).appendTo($("<div class='cell' align='right'></div>").appendTo(row))
		loyaltyAwarenessTable.append(row)

		row = $("<div class='table-row'></div>")

		row.append("<div class='cell' align='left'>" + getAirlineLogoImg(airlineId) + airlineName + "</div>")
        getCapacityImageBar(greenManSource, fromAirportCapacity[airlineId].economy, "economy").appendTo($("<div class='cell' align='right'></div>").appendTo(row))
        getCapacityImageBar(blueManSource, fromAirportCapacity[airlineId].business, "business").appendTo($("<div class='cell' align='right'></div>").appendTo(row))
        getCapacityImageBar(yellowManSource, fromAirportCapacity[airlineId].first, "first").appendTo($("<div class='cell' align='right'></div>").appendTo(row))
        getCapacityImageBar(greenManSource, toAirportCapacity[airlineId].economy, "economy").appendTo($("<div class='cell' align='right'></div>").appendTo(row))
        getCapacityImageBar(blueManSource, toAirportCapacity[airlineId].business, "business").appendTo($("<div class='cell' align='right'></div>").appendTo(row))
        getCapacityImageBar(yellowManSource, toAirportCapacity[airlineId].first, "first").appendTo($("<div class='cell' align='right'></div>").appendTo(row))

        networkCapacityTable.append(row)
	});

}

function getHalfStepImageBarByValue(fullStepImageSrc, halfStepImageSrc, halfStepAmount, value) {
    var containerDiv = $("<div>")
	containerDiv.prop("title", value)

    var halfSteps = Math.floor(value / halfStepAmount)
    var fullSteps = Math.floor(halfSteps / 2)
    var hasRemainder = halfSteps % 2;
    for (i = 0 ; i < fullSteps ; i ++) {
		var image = $("<img src='" + fullStepImageSrc + "'>")
		containerDiv.append(image)
    }
    if (hasRemainder) {
        var image = $("<img src='" + halfStepImageSrc + "'>")
    	containerDiv.append(image)
    }

    return containerDiv
}

function getCapacityImageBar(imageSrc, value, linkClass) {
    var containerDiv = $("<div>")
	containerDiv.prop("title", value)

    if (linkClass == "business") {
        value *= 5
    } else if (linkClass == "first") {
        value *= 20
    }
    var count;
    if (value >= 200000) {
        count = 10
    } else if (value >= 100000) {
        count = 9
    } else if (value >= 50000) {
        count = 8
    } else if (value >= 30000) {
        count = 7
    } else if (value >= 20000) {
        count = 6
    } else if (value >= 10000) {
        count = 5
    } else if (value >= 8000) {
        count = 4
    } else if (value >= 5000) {
        count = 3
    } else if (value >= 2000) {
        count = 2
    } else if (value > 0) {
        count = 1
    } else {
        count = 0
    }

    for (i = 0 ; i < count ; i ++) {
		var image = $("<img src='" + imageSrc + "'>")
		containerDiv.append(image)
    }

    return containerDiv
}

function updateTopCountryComposition(countryComposition) {
	countryComposition = countryComposition.sort(function (a, b) {
	    return b.passengerCount - a.passengerCount 
	});
	
	var max = 5;
	var index = 0;
	$('#linkCompositionModal .topCountryTable .table-row').remove()
	$.each(countryComposition, function(key, entry) {
		$('#linkCompositionModal .topCountryTable').append("<div class='table-row data-row'><div style='display: table-cell; width: 70%;'>" + getCountryFlagImg(entry.countryCode) + entry.countryName
	 			   + "</div><div style='display: table-cell; width: 30%; text-align: right;'>" + commaSeparateNumber(entry.passengerCount) + "</div></div>")
		index ++;
		if (index >= max) {
			return false;
		}
	});
}

function updatePassengerTypeComposition(countryComposition) {
	countryComposition = countryComposition.sort(function (a, b) {
	    return b.passengerCount - a.passengerCount 
	});
	
	$('#linkCompositionModal .passengerTypeTable .table-row').remove()
	$.each(countryComposition, function(key, entry) {
		$('#linkCompositionModal .passengerTypeTable').append("<div class='table-row data-row'><div style='display: table-cell; width: 70%;'>" + entry.title
	 			   + "</div><div style='display: table-cell; width: 30%; text-align: right;'>" + commaSeparateNumber(entry.passengerCount) + "</div></div>")
	});
}

function updatePrefernceTypeComposition(countryComposition) {
	countryComposition = countryComposition.sort(function (a, b) {
	    return b.passengerCount - a.passengerCount 
	});
	
	$('#linkCompositionModal .preferenceTypeTable .table-row').remove()
	$.each(countryComposition, function(key, entry) {
		$('#linkCompositionModal .preferenceTypeTable').append("<div class='table-row data-row'><div style='display: table-cell; width: 70%;'>" + entry.title
	 			   + "</div><div style='display: table-cell; width: 30%; text-align: right;'>" + commaSeparateNumber(entry.passengerCount) + "</div></div>")
	});
}

