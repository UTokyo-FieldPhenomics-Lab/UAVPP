var markers = new Array(); //markerオブジェクト
var polygonPath = new Array(); //latLngオブジェクト
var waypoints = new Array(); //latLngオブジェクト
var waypointsGrid = new Array();
var flightPath = new google.maps.Polyline();
var flightPathGrid = new google.maps.Polyline();
var polygon = new google.maps.Polygon();
var InitialHeading; //飛行の方向
var altitudeMarkers = new Array(); //altitudeMarkerオブジェクト

$(function () {
	//地図表示
	var $map = $("#map")[0];
	var map;
	navigator.geolocation.getCurrentPosition(
		function (p) {
			var options = {
				zoom: 18,
				center: new google.maps.LatLng(p.coords.latitude, p.coords.longitude),
				mapTypeId: google.maps.MapTypeId.SATELLITE
			};
			map = new google.maps.Map($map, options);
		},
		function (error) {
			var options = {
				zoom: 2,
				center: new google.maps.LatLng(0, 0),
				mapTypeId: google.maps.MapTypeId.SATELLITE
			};
			map = new google.maps.Map($map, options);			
		}
	);
	
	//緯度経度指定で地図移動
	$('#moveButton').click(function() {
		map.panTo(new google.maps.LatLng($('#latitude').val(), $('#longitude').val()));
	});
	
	var inputsForUAV = [$('#height'), $('#cameraDirection'), $('#overlapX'), $('#overlapY'), $('#shutterInterval')];
	var inputsForCamera = [$('#imageSensorX'), $('#imageSensorY'), $('#focusLength'), $('#fRatio')];
	$.each(inputsForUAV, function() {
		var target = this;
		target.focus(function() {
			$('input:disabled').val('');
			bottomPaneDisabled();
			clearFlightPath();
		}).blur(function() {
			if (target.val() == '') {
				target.val('NaN');
			}
			bottomPaneEnabled();
			checkCameraSpec();
			if (markers.length > 0) {
				drawFlightPath();
			}
		});
	});
	$.each(inputsForCamera, function() {
		var target = this;
		target.focus(function() {
			$('input:disabled').val('');
			bottomPaneDisabled();
			clearFlightPath();
			$cameraSelect.val('');
		}).blur(function() {
			if (target.val() == '') {
				target.val('NaN');
			}
			bottomPaneEnabled();
			checkCameraSpec();
			if (markers.length > 0) {
				drawFlightPath();
			}
		});
	});	

	var $cameraSelect = $('#cameraSelect');
	$cameraSelect.append('<option>');
	for (var i = 0; i < cameraList.length; i++) {
		var $option = $('<option>').html(cameraList[i].name).val(JSON.stringify(cameraList[i]));
		if (i == 0) {
			$option.attr('selected', true);
			$('#imageSensorX').val(cameraList[0].sensorX);
			$('#imageSensorY').val(cameraList[0].sensorY);
			$('#focusLength').val(cameraList[0].focusLength);
			$('#fRatio').val(cameraList[0].fRatio);
			checkCameraSpec();
		}
		$cameraSelect.append($option);
	}
	
	//カメラ<select>に変化
	$cameraSelect.change(function() {
		clearFlightPath();
		if($cameraSelect.val()) {
			var obj = JSON.parse($cameraSelect.val());
			$('#imageSensorX').val(obj.sensorX);
			$('#imageSensorY').val(obj.sensorY);
			$('#focusLength').val(obj.focusLength);
			$('#fRatio').val(obj.fRatio);
			checkCameraSpec();
			if (markers.length > 0) {
				drawFlightPath();
			}
			bottomPaneEnabled();
		}
		else {
			bottomPaneDisabled();
			$('#imageSensorX').val('');
			$('#imageSensorY').val('');
			$('#focusLength').val('');
			$('#fRatio').val('');
			$('input:disabled').val('');
		}
	});
	
	function bottomPaneDisabled() {
		$('#bottomPane').find('textarea').attr('disabled', 'disabled');
		$('#bottomPane').find('select').attr('disabled', 'disabled');
		$('#bottomPane').find('button').attr('disabled', 'disabled');
	}

	function bottomPaneEnabled() {
		$('#bottomPane').find('textarea').removeAttr('disabled');
		$('#bottomPane').find('select').removeAttr('disabled');
		$('#bottomPane').find('button').removeAttr('disabled');
	}

	function checkCameraSpec() {
		var height = $('#height').val();
		if (!(height > 0)) {
			height = 30;
			$('#height').val('30');
		}
		var overlapX = $('#overlapX').val();
		if (!((overlapX > 0) && (overlapX < 100))) {
			overlapX = 80;
			$('#overlapX').val('80');
		}
		var overlapY = $('#overlapY').val();
		if (!((overlapY > 0) && (overlapY < 100))) {
			overlapY = 80;
			$('#overlapY').val('80');
		}
		var shutterInterval = $('#shutterInterval').val();
		if (!(shutterInterval > 0)) {
			shutterInterval = 2;
			$('#shutterInterval').val('2');
		}

		var imageSensorX = $('#imageSensorX').val();
		var imageSensorY = $('#imageSensorY').val();
		var focusLength = $('#focusLength').val();
		var fRatio = $('#fRatio').val();
		
		//画角
		$('#angleX').val((2 * Math.atan(imageSensorX / (2 * focusLength))) * 180 / Math.PI);
		$('#angleY').val((2 * Math.atan(imageSensorY / (2 * focusLength))) * 180 / Math.PI);
		
		//撮影範囲
		var shootingRangeX = height * imageSensorX / focusLength;
		var shootingRangeY = height * imageSensorY / focusLength
		$('#shootingRangeX').val(shootingRangeX);
		$('#shootingRangeY').val(shootingRangeY);

		//被写界深度
		var blurCircle = Math.sqrt(Math.pow(imageSensorX, 2) + Math.pow(imageSensorY, 2)) / 1300;
		var frontDOF = (blurCircle * fRatio * Math.pow((height * 1000), 2)) / (Math.pow(focusLength, 2) + blurCircle * fRatio * (height * 1000)) / 1000;
		var rearDOF = (blurCircle * fRatio * Math.pow((height * 1000), 2)) / (Math.pow(focusLength, 2) - blurCircle * fRatio * (height * 1000)) / 1000;
		var dof = frontDOF + rearDOF;
		if (frontDOF < 0) {
			frontDOF = 'infinity';
		}
		if (rearDOF < 0) {
			rearDOF = 'infinity';
		}
		if (dof < 0) {
			dof = 'infinity';
		}
		$('#frontDOF').val(frontDOF);
		$('#rearDOF').val(rearDOF);
		$('#DOF').val(dof);
		
		//速度
		var speed = (100 - overlapY) / 100 * shootingRangeY / shutterInterval;
		if (($('#cameraDirection').val() == '90') || ($('#cameraDirection').val() == '270')) {
			speed = (100 - overlapX) / 100 * shootingRangeX / shutterInterval;
		}
		$('#speed').val(Math.round(speed * 1000) / 1000);
		$('#speed2').val(Math.round(speed * 3600) / 1000);
		
		//グリッド間隔
		var gridInterval = (100 - overlapX) / 100 * shootingRangeX;
		if (($('#cameraDirection').val() == '90') || ($('#cameraDirection').val() == '270')) {
			gridInterval = (100 - overlapY) / 100 * shootingRangeY;
		}
		$('#gridInterval').val(Math.round(gridInterval * 1000) / 1000);
		if(!$.isNumeric(gridInterval)) {
			bottomPaneDisabled();
		}
	}
	
	//情報更新
	$('#update').click(function() {
		checkCameraSpec();
		createCSV();
	});

	//ウェイポイントを地図内クリックでセット
	$('#start').click(function() {
		$('#start').hide();
		$('#finish').show();
		clearFlightPath();
		clearPolygon();
		google.maps.event.addListener(map, 'click', function(e) {
			var position = new google.maps.LatLng(e.latLng.lat(), e.latLng.lng());
			markers.push(new google.maps.Marker({
				position: position,
				map: map,
				icon: 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=' + markers.length + '|FE6256|000000',
				draggable: true
			}));
			var currentCoordinates = $('#coordinates').val();
			if (currentCoordinates == '') {
				$('#coordinates').val(position.lat() + ',' + position.lng());
			}
			else {
				$('#coordinates').val(currentCoordinates + "\n" + position.lat() + ',' + position.lng());
			}
		});
	});
	$('#finish').click(function() {
		$('#start').show();
		$('#finish').hide();
		google.maps.event.clearListeners(map, 'click');
		if (markers.length > 2) {
			for (var i = 0; i < markers.length; i++) {
				google.maps.event.addListener(markers[i], 'dragend', drawPolygon);
			}
			drawPolygon();
			//setSlopingMenu();
		}
		else {
			clearPolygon();
		}
	});
	$('#finish').hide();

	$('#drawPolygonButton').click(function(e) {
		clearPolygon();
		var lines = $('#latLngTextarea').val().split(/\r\n|\r|\n/);
		for (var i = 0; i < lines.length; i++) {
			var latLng = lines[i].split(/ /);
			var position = new google.maps.LatLng(latLng[0], latLng[1]);
			markers[i] = new google.maps.Marker({
				position: position,
				map: map,
				icon: 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=' + markers.length + '|FE6256|000000',
				draggable: true
			});
			google.maps.event.addListener(markers[i], 'dragend', drawPolygon);
		}
		drawPolygon();
	});
	
	//Initial Direction変更
	$('#initialDirection').bind('keyup mouseup', function() {
		if (waypoints.length > 0) {
			clearFlightPath();
			drawFlightPath();
		}
	});
	
	//ポリゴン描画
	function drawPolygon() {
		if (($('#gridInterval').val() > 0) && ($('#gridInterval').val() != 'NaN')){
			clearFlightPath();
			polygon.setMap(null);
			polygonPath.length = 0;
			var path = new Array();
			var latSum = 0;
			var lngSum = 0;
			$('#coordinates').val('');
			for (var i = 0; i < markers.length; i++) {
				var lat = markers[i].position.lat();
				var lng = markers[i].position.lng();
				var position = new google.maps.LatLng(lat, lng);
				polygonPath.push(position);
				latSum += lat;
				lngSum += lng;
				var currentCoordinates = $('#coordinates').val();
				if (i == 0) {
					$('#coordinates').val(lat + ',' + lng);
				}
				else {
					$('#coordinates').val(currentCoordinates + '\n' + lat + ',' + lng);
				}
			}
			var direction = google.maps.geometry.spherical.computeHeading(polygonPath[0], polygonPath[1]);
			if ($('#initialDirection').val() == '') {
				$('#initialDirection').val(direction);
			}
			map.panTo(new google.maps.LatLng(latSum / markers.length, lngSum / markers.length));
			polygon = new google.maps.Polygon({
				path: polygonPath,
				strokeColor: 'red',
				strokeWeight: 3,
				strokeOpacity: 0.3,
				fillColor: 'red',
				fillOpacity: 0.3
			});
			polygon.setMap(map);
			drawFlightPath();
			$('#reverse').attr('disabled', false);
			$('#clear').attr('disabled', false);
		}
		else {
			clearPolygon();
		}
	}
	
	function clearPolygon() {
		$('#coordinates').val('');
		$('#initialDirection').val('');
		polygon.setMap(null);
		$('#draw').attr('disabled', true);
		$('#reverse').attr('disabled', true);
		$('#clear').attr('disabled', true);
		for (var i = 0; i < markers.length; i++) {
			markers[i].setMap(null);
		}
		markers.length = 0;
		polygonPath.length = 0;
	}

	//coordinatesテキストエリアの内容を元にマーカーをセット
	function setMarkersByCoordinates() {
		for (var i = 0; i < markers.length; i++) {
			markers[i].setMap(null);
		}
		markers.length = 0;
		var currentCoordinates = $('#coordinates').val();
		var lines = currentCoordinates.split('\n');
		for (var i = 0; i < lines.length; i++) {
			var latLng = lines[i].split(',');
			var lat = Number(latLng[0]);
			var lng = Number(latLng[1]);
			if (lat && lng) {
				var position = new google.maps.LatLng(lat, lng);
				markers.push(new google.maps.Marker({
					position: position,
					map: map,
					icon: 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=' + markers.length + '|FE6256|000000',
					draggable: true
				}));
				google.maps.event.addListener(markers[markers.length - 1], 'dragend', drawPolygon);
			}
		}
		if (markers.length > 2) {
			drawPolygon();
		}
		else {
			clearPolygon();
			clearFlightPath();
		}
	}
	
	//Drawボタンのクリック時
	$('#draw').click(function() {
		$('#draw').attr('disabled', true);
		setMarkersByCoordinates();
		//setSlopingMenu();
	});
	//coordinatesテキストエリアに入ったらDrawボタンを使えるようにする
	$('#coordinates').focus(function() {
		$('#draw').attr('disabled', false);
	});
	
	//Reverseボタンのクリック時
	$('#reverse').click(function() {
		//緯度経度処理
		var currentCoordinates = $('#coordinates').val();
		var lines = currentCoordinates.split('\n');
		var newCoordinates = lines[0];
		for (var i = lines.length - 1; i > 0; i--) {
			newCoordinates += '\n' + lines[i];
		}
		$('#coordinates').val(newCoordinates);
		
		/*
		//Sloping処理
		var pointList1 = $('#pointList1').val();
		var pointList2 = $('#pointList2').val();
		var point1Height = $('#point1Height').val();
		var point2Height = $('#point2Height').val();
		$('#pointList1').val(lines.length - pointList1);
		$('#pointList2').val(lines.length - pointList2);
		//$('#point1Height').val(point2Height);
		//$('#point2Height').val(point1Height);
		*/
		
		setMarkersByCoordinates();
	});
	
	//GridFlightチェック
	$('#gridFlight').change(function(e) {
		if ($(this).prop('checked')) {
			$('#distance').show();
			$('#distance2').hide();
			$('#flightTime').show();
			$('#flightTime2').hide();
			flightPathGrid.setVisible(true);
		}
		else {
			$('#distance').hide();
			$('#distance2').show();
			$('#flightTime').hide();
			$('#flightTime2').show();
			flightPathGrid.setVisible(false);
		}
	});
	
	//飛行計画作成
	function drawFlightPath() {
		InitialHeading = parseFloat($('#initialDirection').val());
		var gridInterval = parseFloat($('#gridInterval').val());
		var startPoint = polygonPath[0];

		culcFlightPath({
			heading: InitialHeading,
			gridInterval: gridInterval,
			startPoint: startPoint,
			result: waypoints
		});
		flightPath = new google.maps.Polyline({
			path: waypoints,
			strokeColor: 'yellow',
			zIndex: 5,
			strokeWeight: 4,
			map: map
		});
		var distance = Math.ceil(google.maps.geometry.spherical.computeLength(flightPath.getPath()));
		var speed = $('#speed').val();
		var flightTime = distance / speed //単純計算の飛行時間
						+ (flightPath.getPath().getLength()) * 3 //ウェイポイント一つあたり3秒ロス
						+ $('#height').val() * 2 / 3; //上昇、降下は3m/sとして計算
		
		culcFlightPath({
			heading: InitialHeading + 90,
			gridInterval: gridInterval,
			startPoint: waypoints[waypoints.length - 1],
			result: waypointsGrid
		});
		flightPathGrid = new google.maps.Polyline({
			path: waypointsGrid,
			strokeColor: '#4ff',
			strokeOpacity: 0.8,
			zIndex: 6,
			strokeWeight: 3,
			visible: $('#gridFlight').prop('checked'),
			map: map
		});
		var distance2 = Math.ceil(google.maps.geometry.spherical.computeLength(flightPathGrid.getPath()));
		var flightTime2 = distance2 / speed + (flightPathGrid.getPath().getLength()) * 3;
		distance += distance2;
		flightTime += flightTime2;

		flightTime = Math.ceil(flightTime / 60); //分に変換、小数点以下切り上げ
		flightTime2 = Math.ceil(flightTime2 / 60); //分に変換、小数点以下切り上げ
		
		if ($('#gridFlight').prop('checked')) {
			$('#distance').show();
			$('#distance2').hide();
			$('#flightTime').show();
			$('#flightTime2').hide();
		}
		else {
			$('#distance').hide();
			$('#distance2').show();
			$('#flightTime').hide();
			$('#flightTime2').show();
		}
		$('#distance').val(distance);
		$('#distance2').val(distance2);
		$('#flightTime').val(flightTime);
		$('#flightTime2').val(flightTime2);

		//CSVを生成
		createCSV();
		
		//高低差設定表示
		//$('#enableSloping').show();
	}

	//飛行経路の計算
	function culcFlightPath(p) {
		var pointZero = null;
		var pointsPlus = new Array();
		var pointsMinus = new Array();
		baseHeading = p.heading;
		var gridInterval = p.gridInterval;
		var startPoint = p.startPoint;
		var result = p.result;

		//ウェイポイント決定
		var prevPoint = polygonPath[0];
		var prevLine = (google.maps.geometry.spherical.computeDistanceBetween(startPoint, polygonPath[0]) * Math.sin((google.maps.geometry.spherical.computeHeading(startPoint, polygonPath[0]) - baseHeading) / 180 * Math.PI))  / gridInterval;
		for (var i = 1; i <= polygonPath.length; i++) {
			var point = (i == polygonPath.length) ? polygonPath[0] : polygonPath[i];
			var distance = google.maps.geometry.spherical.computeDistanceBetween(prevPoint, point);
			var heading = google.maps.geometry.spherical.computeHeading(prevPoint, point);
			var projectedDistance = google.maps.geometry.spherical.computeDistanceBetween(startPoint, point) * Math.sin((google.maps.geometry.spherical.computeHeading(startPoint, point) - baseHeading) / 180 * Math.PI);
			var line = projectedDistance / gridInterval;
			
			var start = prevLine;
			var end = line;
			var from = prevPoint;
			var to = point;
			if (start > end) {
				var tmp = start;
				start = end;
				end = tmp;
				var tmp2 = from;
				from = to;
				to = tmp2;
			}
			
			var direction = google.maps.geometry.spherical.computeHeading(from, to);
			var step = Math.abs(gridInterval / Math.sin((baseHeading - heading) / 180 * Math.PI));
			if (!isFinite(step)) {
				step = 0;
			}
			var offset = (Math.ceil(start) - start) * step;
			start = Math.ceil(start);
			
			for (var j = 0; j <= (end - start); j++) {
				var position = new google.maps.geometry.spherical.computeOffset(from, step * j + offset, direction);																																					
				/*
				new google.maps.Marker({
					position: position,
					map: map,
					icon: 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=' + (j + start) + '|FE6256|000000'
				});
				*/
				var lineNumber = j + start;
				if (lineNumber == 0) {
					if (google.maps.geometry.spherical.computeDistanceBetween(startPoint, position) > 1) {
						pointZero = position;
					}
				}
				else if (lineNumber > 0) {
					if(pointsPlus[lineNumber]) {
						if (pointsPlus[lineNumber][0].lat() > position.lat()) {
							pointsPlus[lineNumber].push(position);
						}
						else {
							pointsPlus[lineNumber].unshift(position);
						}
					}
					else {
						pointsPlus[lineNumber] = [position]
					}
				}
				else {
					var index = -1 * lineNumber;
					if(pointsMinus[index]) {
						if (pointsMinus[index][0].lat() > position.lat()) {
							pointsMinus[index].push(position);
						}
						else {
							pointsMinus[index].unshift(position);
						}
					}
					else {
						pointsMinus[index] = [position]
					}
				}
			}
			prevPoint = point;
			prevLine = line;
		}

		//飛行ルート作成
		var fromFar = true;
		result.push(startPoint);
		if (pointZero) {
			result.push(pointZero);
			if (pointZero.lat() > startPoint.lat()) {
				fromFar = false;
			}
		}
		var order = (pointsPlus.length > pointsMinus.length) ? [pointsMinus, pointsPlus] : [ pointsPlus, pointsMinus];
		$.each(order, function(i, val) {
			var pop = false;
			for (var i = 1; i < val.length; i++) {
				if (i == 1) {
					if (fromFar) {
						pop = true;
					}
				}
				if (pop) {
					result.push(val[i][1]);
					result.push(val[i][0]);
				}
				else {
					result.push(val[i][0]);
					result.push(val[i][1]);				
				}
				pop = !pop;
			}
		});
	}
	
	function clearFlightPath() {
		flightPath.setMap(null);
		flightPathGrid.setMap(null);
		waypoints.length = 0;
		waypointsGrid.length = 0;
		flightPath.length = 0;
		flightPathGrid.length = 0;
		$('#csv').val('');
		/*
		while (altitudeMarkers.length > 0) {
			var marker = altitudeMarkers.pop();
			marker.remove();
		}
		$('#enableSloping').hide();
		*/
		$('#download').prop('disabled', 'disabled');
	}
	
	//CSV生成および高度表示
	function createCSV() {
		/*
		//飛行平面：ax+by+cz+d=0として
		var a, b, c, d;
		var x1, y1, z1, x2, y2, z2, x3, y3, z3;
		if($('#enableSlopingCheck').prop('checked')) {
			var point1 = $('#pointList1').val();
			var point2 = $('#pointList2').val();
			x1 = polygonPath[0].lng(), y1 = polygonPath[0].lat(), z1 = 0;
			x2 = polygonPath[point1].lng(), y2 = polygonPath[point1].lat(), z2 = Number($('#point1Height').val());
			x3 = polygonPath[point2].lng(), y3 = polygonPath[point2].lat(), z3 = Number($('#point2Height').val());
			a = (y2 - y1) * (z3 - z1) - (y3 - y1) * (z2 - z1);
			b = (z2 - z1) * (x3 - x1) - (z3 - z1) * (x2 - x1);
			c = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
			d = -1 * (a * x1 + b * y1 + c * z1);
		}
		*/

		var target = $('#csv');
		var csv = 'latitude,longitude,altitude(m),heading(deg),curvesize(m),rotationdir,gimbalmode,gimbalpitchangle,actiontype1,actionparam1,actiontype2,actionparam2,actiontype3,actionparam3,actiontype4,actionparam4,actiontype5,actionparam5,actiontype6,actionparam6,actiontype7,actionparam7,actiontype8,actionparam8,actiontype9,actionparam9,actiontype10,actionparam10,actiontype11,actionparam11,actiontype12,actionparam12,actiontype13,actionparam13,actiontype14,actionparam14,actiontype15,actionparam15\n';
		var speed = '5';
		var height = Number($('#height').val());
		var altitude = height;
		var curvesize = '0.2';
		var cameraHeading = InitialHeading + Number($('#cameraDirection').val());
		if (cameraHeading > 360) {
			cameraHeading -= 360;
		}
		
		for (var i = 0; i < waypoints.length; i++) {
			var lat = waypoints[i].lat();
			var lng = waypoints[i].lng();
			/*
			if ($('#enableSlopingCheck').prop('checked')) {
				var relativeAltitude = -1 * (a * lng + b * lat + d) / c;
				altitude = height + relativeAltitude;
				altitude = Math.round(altitude * 100) / 100; //小数点以下第３位を四捨五入
			}
			altitudeMarkers.push(new altitudeMarker(lat, lng, altitude));
			*/
			
			var action = ['-1,0', '-1,0'];
			/*
			if (i == 0) {
				var j = 0;
				if ($('#tilt1Check').prop('checked')) {
					//ポイント0でカメラをチルト
					action[j] = '5,' + $('#tilt1').val();
					j++;
				}
				if ($('#stayCheck').prop('checked')) {
					//ポイント0でステイ
					action[j] = '0,' + ($('#stay').val() * 1000);
				}
			}
			if (i == waypoints.length - 1) {
				if ($('#tilt2Check').prop('checked')) {
					//最終ポイントでカメラをチルト
					action[0] = '5,' + $('#tilt2').val();
				}
			}
			*/
			csv += lat + ',' + lng + ',' + altitude + ',' + cameraHeading + ',' + curvesize + ',0,0,0,' + action[0] + ',' + action[1] + ',-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0\n';
		}
		
		if ($('#gridFlight').prop('checked')) {
			cameraHeading += 90;
			if (cameraHeading > 360) {
				cameraHeading -= 360;
			}
			//回転のためにウェイポイントを１つ挿入
			var distance = $('#speed').val();
			if (distance < 1) {
				distance = 1;
			}
			if (distance < google.maps.geometry.spherical.computeDistanceBetween(waypointsGrid[0], waypointsGrid[1])) {
				var direction = google.maps.geometry.spherical.computeHeading(waypointsGrid[0], waypointsGrid[1]);
				var newPoint = new google.maps.geometry.spherical.computeOffset(waypointsGrid[0], distance, direction);
				csv +=  newPoint.lat() + ',' + newPoint.lng() + ',' + altitude + ',' + cameraHeading + ',' + curvesize + ',0,0,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0\n';
			}
			for (var i = 1; i < waypointsGrid.length; i++) {
				var lat = waypointsGrid[i].lat();
				var lng = waypointsGrid[i].lng();
	
				csv += lat + ',' + lng + ',' + altitude + ',' + cameraHeading + ',' + curvesize + ',0,0,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0\n';
			}		
		}

		target.val(csv);
		$('#download').prop('disabled', '');
	}
	
	//クリアボタンクリック
	$('#clear').click(function(e) {
		clearFlightPath();
		clearPolygon();
	});

	//ダウンロード
	$('#download').click(function(e) {
		createCSV();
		
		var bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
		var content = $('#csv').val();
		var filename = $('#filename').val();
		var blob = new Blob([ bom, content ], { 'type' : 'text/csv' });

		if (window.navigator.msSaveBlob) {
			//IE
			window.navigator.msSaveBlob(blob, filename + '.csv');
		}
		else {
			var a = document.createElement("a");
			a.href = window.URL.createObjectURL(blob);
			a.download = filename + '.csv';
 			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		}
	});
	
	/*
	//Enable Slopingメニュー用ポイントリスト作成
	function setSlopingMenu() {
		var $pointList1 = $('#pointList1');
		var $pointList2 = $('#pointList2');
		$pointList1.empty();
		$pointList2.empty();
		for (var i = 1; i < polygonPath.length; i++) {
			$pointList1.append('<option value="' + i + '">' + i +'</option>');
			$pointList2.append('<option value="' + i + '">' + i +'</option>');
		}
		$pointList1.val(1);
		$pointList2.val(polygonPath.length - 1);	
	}

	//高度マーカー
	function altitudeMarker (lat, lng, altitude) {
		this.lat = lat;
		this.lng = lng;
		this.altitude = altitude;
		this.setMap(map);
	}
	altitudeMarker.prototype = new google.maps.OverlayView();
	altitudeMarker.prototype.draw = function() {
		if (!this.div) {
			this.div = document.createElement('div');
			this.div.class = 'altitudeMarker';
			this.div.style.color = '#fff';
			this.div.style.backgroundColor = '#000';
			this.div.style.zIndex = 100;
			this.div.style.position = 'absolute';
			this.div.style.fontSize = '12px';
			this.div.innerHTML = this.altitude + 'm';
			var panes = this.getPanes();
			panes.overlayLayer.appendChild(this.div);
		}
		var point = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.lat, this.lng));
		this.div.style.left = (point.x - 10) + 'px';
		this.div.style.top = (point.y - 10) + 'px';
	};
	altitudeMarker.prototype.remove = function() {
		if(this.div) {
			this.div.parentNode.removeChild(this.div);
			this.div = null;
		}
		this.setMap(null);
	}

	//Slopingのオンオフ
	var inputsForSloping = [$('#pointList1'), $('#pointList2'), $('#point1Height'), $('#point2Height')];
	$('#enableSlopingCheck').change(function(e) {
		if ($('#enableSlopingCheck').prop('checked')) {
			$.each(inputsForSloping, function() {
				this.attr('disabled', false);
			});
		}
		else {
			$.each(inputsForSloping, function() {
				this.attr('disabled', true);
			});			
		}
		while (altitudeMarkers.length > 0) {
			var marker = altitudeMarkers.pop();
			marker.remove();
		}
		createCSV();
	});

	//Slopingのインプットのblur処理
	$.each(inputsForSloping, function() {
		var target = this;
		target.blur(function() {
			createCSV();
		});
	});
	*/
	
});

