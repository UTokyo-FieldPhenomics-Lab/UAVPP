$(() => {
  $('#map').height($(window).height()).width($(window).width() - $('div.form').width() - 12);
  $(window).on('resize', () => $('#map').height($(window).height()).width($(window).width() - $('div.form').width() - 12));

  const map = L.map('map');
  navigator.geolocation.getCurrentPosition(
		(p) => map.setView([p.coords.latitude, p.coords.longitude], 18),
		(error) => map.setView([0, 0], 2)
	);

  const openStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  const gsiMap = L.tileLayer('http://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg', {
    maxNativeZoom: 18,
    maxZoom: 20,
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>"
  });
  const baseMaps = {
    OpenStreetMap: openStreetMap,
    "GSI(Japan)": gsiMap
  }
  L.control.layers(baseMaps).addTo(map);
  openStreetMap.addTo(map);
  const pd = new polygonDraw();
  const path = new flightPath();

  function polygonDraw() {
    this.points = new Array();
    this.polyline = new L.polyline([], {color: 'red'}).addTo(map);
    this.polygon = new L.polygon([], {color: 'red', weight: 0}).addTo(map);
    this.markers = L.layerGroup().addTo(map);

    //jump control
    const jumpControlContainer = L.control({position: "topleft"});
    jumpControlContainer.onAdd = () => {
      this.e = L.DomUtil.create('div', 'jumpControlContainer');
      this.e.id = 'jumpControlContainer';
      this.e.onclick = function (e) {e.stopPropagation()};
      this.e.ondblclick = function (e) {e.stopPropagation()};
      return this.e;
    }
    jumpControlContainer.addTo(map);
    const $jumpControlContainer = $('#jumpControlContainer');
    const $jumpControl = $('<div class="jumpControl"><i class="fas fa-location-arrow"></i></div>').appendTo($jumpControlContainer)
    .on('click', () => {
      const $overlay = $('<div id="overlay">').appendTo('body');
      const $modal = $('<div id="modalWindow2">').appendTo($overlay)
      .on('click', () => {return false})
      .css({
        top: $jumpControl.offset().top,
        left: $jumpControl.offset().left + 35
      });
      const $input = $('<input placeholder="latitude,longitude">');
      $input.appendTo($modal);
      $('<button>Set</button>').appendTo($modal)
      .on('click', () => {
        const text = $input.val();
        const coords = text.split(',');
        try {
          map.panTo(L.latLng(coords[0], coords[1]));
        }
        catch (e) {
          alert('Invalid format: "' + text + '"');
          return;
        }
        $overlay.fadeOut(300, () => $overlay.remove());
      });
      $('<button>Cancel</button>').appendTo($modal)
      .on('click', () => $overlay.fadeOut(300, () => $overlay.remove()));
      $overlay.fadeIn(300).on('click', () => $overlay.fadeOut(300, () => $overlay.remove()));
    });

    //polygon draw control
    const drawControlContainer = L.control({ position: "bottomleft" });
    drawControlContainer.onAdd = () => {
      this.e = L.DomUtil.create('div', 'drawControlContainer');
      this.e.id = 'drawControlContainer';
      this.e.onclick = function (e) {e.stopPropagation()};
      this.e.ondblclick = function (e) {e.stopPropagation()};
      return this.e;
    };
    drawControlContainer.addTo(map);
    const $drawControlContainer = $('#drawControlContainer');
    //draw polygon controls
    const $polygonDrawControl = $('<div class="drawControl"><i class="fas fa-draw-polygon fa-lg"></i> Polygon</div>').appendTo($drawControlContainer)
    .on('click', () => {
      if ($polygonDrawControl.hasClass('working')) {
        $polygonDrawControl.removeClass('working');
        _finish();
      }
      else {
        $polygonDrawControl.addClass('working');
        _start();
      }
    });
    const $clearControl = $('<div class="drawControl"><i class="fas fa-eraser fa-lg"></i> Clear</div>').appendTo($drawControlContainer)
    .hide()
    .on('click', () => {
      map.off('click mousemove');
      _clear();
    });
    //import geoJSON control
    const $importFileInput = $('<input type="file">').appendTo($drawControlContainer)
    .hide()
    .on('change', (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => {
        if (file.type == 'application/json') {
          let polygon;
          try {
            const json = JSON.parse(reader.result);
            if (json.geometry.type == 'Polygon') polygon = json.geometry.coordinates[0];
          }
          catch (e) {
            window.alert('The file is not valid.');
            return;
          }
          _clear();
          polygon.pop();
          $.each(polygon, (i, v) => {
            _push(L.latLng(v[1], v[0]));
          });
          _finish();
          map.fitBounds(this.polygon.getBounds());
        }
        else {
          window.alert('Accept only MIME-type "application/json" file.');
        }
      }
      $importFileInput.val('');
    });
    const $importGeoJSONControl = $('<div class="drawControl"><i class="fas fa-file-import fa-lg"></i> Import GeoJSON</div>').appendTo($drawControlContainer)
    .on('click', () => $importFileInput.trigger('click'));
    //input latlngs control
    const $inputLatLngsControl = $('<div class="drawControl"><i class="fas fa-pencil-alt fa-lg"></i> Input LatLngs</div>').appendTo($drawControlContainer)
    .on('click', () => {
      const $overlay = $('<div id="overlay">').appendTo('body');
      const $modal = $('<div id="modalWindow">').appendTo($overlay)
      .on('click', () => {return false})
      .css({
        top: $inputLatLngsControl.offset().top - 150,
        left: $inputLatLngsControl.offset().left
      });
      const $textarea = $('<textarea placeholder="latitude1,longitude1\nlatitude2,longitude2\n...">');
      $textarea.wrap('<div>').parent().appendTo($modal);
      $('<button>Set</button>').appendTo($modal)
      .on('click', () => {
        const text = $textarea.val();
        const coords = text.split('\n');
        let valid = true;
        $.each(coords, (i, v) => {
          const latLng = v.split(',');
          try {
            _push(L.latLng(latLng[0], latLng[1]));
          }
          catch (e) {
            alert('Invalid format: "' + v + '"');
            _clear();
            valid = false;
            return;
          }
        });
        if (valid) {
          _finish();
          map.fitBounds(this.polygon.getBounds());
        }
        $overlay.fadeOut(300, () => $overlay.remove());
      });
      $('<button>Cancel</button>').appendTo($modal)
      .on('click', () => $overlay.fadeOut(300, () => $overlay.remove()));
      $overlay.fadeIn(300).on('click', () => $overlay.fadeOut(300, () => $overlay.remove()));
    });
    //export geoJSON control
    const $exportGeoJSONControl = $('<div class="drawControl"><i class="fas fa-file-download fa-lg"></i> Export GeoJSON</div>').appendTo($drawControlContainer)
    .hide()
    .on('click', () => {
      //const geoJSON = this.polygon.toGeoJSON(); //leaflet v.1.4.0 toGeoJSON has problems: latlng values rounded
      const geoJSON = _geoJSON(this.polygon.getLatLngs()[0]);
      const $a = $('<a>').appendTo('body')
      .css('display', 'none')
      .attr('href', window.URL.createObjectURL(new Blob([JSON.stringify(geoJSON, null, "\t")])))
      .attr('download', 'geoJSON.json');
      $a[0].click();
      $a.remove();
    });
    //export flight path control
    const $exportFlightPathControl = $('<div class="drawControl"><i class="fas fas fa-file-csv fa-lg"></i> Export Flight Path</div>').appendTo($drawControlContainer)
    .hide()
    .on('click', () => downloadCSV());

    this.getPolygon = () => {
      return this.polygon.getLatLngs()[0];
    }

    _push = (latlng) => {
      $clearControl.show();
      $importGeoJSONControl.hide();
      $inputLatLngsControl.hide();
      this.points.push(latlng);
      this.polyline.setLatLngs(this.points);
      this.polygon.setLatLngs(this.points);
      const marker = L.marker(latlng, {draggable: true});
      this.markers.addLayer(marker);
      const index = this.points.length - 1;
      marker.on('drag', (e) => {
        const points = this.points.slice();
        points[index] = e.latlng;
        this.polyline.setLatLngs(points);
        this.polygon.setLatLngs(points);
      })
      .on('dragstart', () => {
        path.remove();
      })
      .on('dragend', () => {
        this.points[index] = marker.getLatLng();
        this.polyline.setLatLngs(this.points);
        this.polygon.setLatLngs(this.points);
        path.update();
      });
    }

    _start = () => {
      $polygonDrawControl.addClass('working');
      map.on('click', (e) => _push(e.latlng));
    }

    _finish = () => {
      $polygonDrawControl.removeClass('working');
      if (this.points.length > 0) {
        if (this.points.length < 3) {
          _clear();
        }
        else {
          $importGeoJSONControl.hide();
          $exportGeoJSONControl.show();
          $inputLatLngsControl.hide();
          $polygonDrawControl.hide();
          $exportFlightPathControl.show();
        }
      }
      else $clearControl.hide();
      map.off('click mousemove');
      this.polyline.setLatLngs([]);
      this.polygon.setLatLngs(this.points);
      this.polygon.setStyle({weight: 3});
      path.update();
    }

    _clear = () => {
      $polygonDrawControl.removeClass('working');
      $clearControl.hide();
      $importGeoJSONControl.show();
      $exportGeoJSONControl.hide();
      $inputLatLngsControl.show();
      $polygonDrawControl.show();
      $exportFlightPathControl.hide();
      this.points = [];
      this.markers.clearLayers();
      this.polyline.setLatLngs([]);
      this.polygon.setLatLngs([]);
      this.polygon.setStyle({weight: 0});
      path.remove();
    }

    _geoJSON = (latlngs) => { //only for simple polygon
      const coords = new Array();
      $.each(latlngs, (i, v) => coords.push([v.lng, v.lat]));
      coords.push(coords[0]);
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coords]
        }
      }
    }
  };

  //inputs control
  const inputsForUAV = [$('#height'), $('#cameraDirection'), $('#overlapX'), $('#overlapY'), $('#shutterInterval')];
	const inputsForCamera = [$('#imageSensorX'), $('#imageSensorY'), $('#foculLength'), $('#fRatio')];
	$.each(inputsForUAV, (i, v) => {
		v.on('keyup mouseup', () => {
			setInputsValue();
			path.update();
		});
	});
	$.each(inputsForCamera, (i, v) => {
		v.on('keyup mouseup blur', () => {
			setInputsValue();
			path.update();
		});
	});
  $('#height').on('blur', () => {
    if (!($('#height').val() > 0)) $('#height').val(30);
    setInputsValue();
    path.update();
  });
  $('#shutterInterval').on('blur', () => {
    if (!($('#shutterInterval').val() > 0)) $('#shutterInterval').val(2);
    setInputsValue();
  });
  $('#overlapX').on('blur', () => {
    if (!($('#overlapX').val() > 0) && ($('#overlapX').val() < 100)) $('#overlapX').val(80);
    setInputsValue();
    path.update();
  });
  $('#overlapY').on('blur', () => {
    if (!($('#overlapY').val() > 0) && ($('#overlapY').val() < 100)) $('#overlapY').val(80);
    setInputsValue();
  });
  $('#flightMode').on('change', () => path.update());
  $('#initialDirection').on('keyup mouseup', () => {
    const num = parseFloat($('#initialDirection').val());
    if (Number.isNaN(num)) {
      path.remove();
    }
    else {
      if ($('#initialDirection').val() > 360) $('#initialDirection').val(num % 360);
      if ($('#initialDirection').val() < -180) $('#initialDirection').val(360 + num % 360);
      path.update();
    }
  });
  $('#directionReset').on('click', (e) => {
    $('#initialDirection').val('');
    path.update();
    e.preventDefault();
  });

  //set camera list
  const $cameraSelect = $('#cameraSelect').append('<option>');
  $.each(cameraList, (i, v) => {
    const $option = $('<option>').html(v.name).val(JSON.stringify(v));
		if (i == 0) {
			$option.attr('selected', true);
			$('#imageSensorX').val(v.sensorX);
			$('#imageSensorY').val(v.sensorY);
			$('#foculLength').val(v.foculLength);
			$('#fRatio').val(v.fRatio);
			setInputsValue();
		}
		$cameraSelect.append($option);
  });
  //set camera <select> event
  $cameraSelect.on('change', () => {
		if($cameraSelect.val()) {
			const obj = JSON.parse($cameraSelect.val());
			$('#imageSensorX').attr('disabled', 'disabled').val(obj.sensorX);
			$('#imageSensorY').attr('disabled', 'disabled').val(obj.sensorY);
			$('#foculLength').attr('disabled', 'disabled').val(obj.foculLength);
			$('#fRatio').attr('disabled', 'disabled').val(obj.fRatio);
			setInputsValue();
		}
		else {
			$('#imageSensorX').attr('disabled', false).val('');
			$('#imageSensorY').attr('disabled', false).val('');
			$('#foculLength').attr('disabled', false).val('');
			$('#fRatio').attr('disabled', false).val('');
			$('input:disabled').val('');
		}
    path.update();
	});

  function setInputsValue() {
    const height = $('#height').val();
    const shutterInterval = $('#shutterInterval').val();
    const overlapX = $('#overlapX').val();
    const overlapY = $('#overlapY').val();
		const imageSensorX = $('#imageSensorX').val();
		const imageSensorY = $('#imageSensorY').val();
		const foculLength = $('#foculLength').val();
		const fRatio = $('#fRatio').val();

		//set angle
		$('#angleX').val(Math.round((2 * Math.atan(imageSensorX / (2 * foculLength))) * 180 / Math.PI * 100) / 100);
		$('#angleY').val(Math.round((2 * Math.atan(imageSensorY / (2 * foculLength))) * 180 / Math.PI * 100) / 100);
		//set shooting range
		const shootingRangeX = height * imageSensorX / foculLength;
		const shootingRangeY = height * imageSensorY / foculLength
		$('#shootingRangeX').val(Math.round(shootingRangeX * 100) / 100);
		$('#shootingRangeY').val(Math.round(shootingRangeY * 100) / 100);
		//set depth of field
		const blurCircle = Math.sqrt(Math.pow(imageSensorX, 2) + Math.pow(imageSensorY, 2)) / 1300;
		const frontDOF = (fRatio > 0) ? (blurCircle * fRatio * Math.pow((height * 1000), 2)) / (Math.pow(foculLength, 2) + blurCircle * fRatio * (height * 1000)) / 1000 : '';
		const rearDOF = (fRatio > 0) ? (blurCircle * fRatio * Math.pow((height * 1000), 2)) / (Math.pow(foculLength, 2) - blurCircle * fRatio * (height * 1000)) / 1000 : '';
		const dof = (fRatio > 0) ? (frontDOF + rearDOF) : '';
		$('#frontDOF').val((frontDOF < 0) ? 'infinity' : (frontDOF ? Math.round(frontDOF * 100) / 100 : ''));
		$('#rearDOF').val((rearDOF < 0) ? 'infinity' : (rearDOF ? Math.round(rearDOF * 100) / 100 : ''));
		$('#DOF').val((dof < 0) ? 'infinity' : (dof ? Math.round(dof * 100) / 100 : ''));
		//set speed
		const speed = (($('#cameraDirection').val() == '90') || ($('#cameraDirection').val() == '270')) ?
      (100 - overlapX) / 100 * shootingRangeX / shutterInterval : (100 - overlapY) / 100 * shootingRangeY / shutterInterval;
		$('#speed').val(Math.round(speed * 100) / 100);
		$('#speed2').val(Math.round(speed * 360) / 100);
		//set grid interval
		const gridInterval = (($('#cameraDirection').val() == '90') || ($('#cameraDirection').val() == '270')) ?
      (100 - overlapY) / 100 * shootingRangeY : (100 - overlapX) / 100 * shootingRangeX;
		$('#gridInterval').val(Math.round(gridInterval * 100) / 100);
	}

  function flightPath() {
    this.points = new Array();
    this.pointsGrid = new Array();
    this.polyline = L.polyline([], {color: 'yellow'});
    this.polylineGrid = L.polyline([], {color: '#4ff'});

    this.remove = () => {
      this.points = [];
      this.pointsGrid = [];
      map.removeLayer(this.polyline);
      map.removeLayer(this.polylineGrid);
    }

    this.update = () => {
      this.remove();

      const polygon = pd.getPolygon();
      if (polygon.length < 3) return;

      const gridInterval = parseFloat($('#gridInterval').val());
      if (!(gridInterval > 0)) return;

      let initialHeading;
      if ($('#initialDirection').val() == '') {
        initialHeading = turf.bearing(turfPoint(polygon[0]), turfPoint(polygon[1]));
        $('#initialDirection').val(initialHeading);
      }
      else {
        initialHeading = parseFloat($('#initialDirection').val());
      }
      const flightMode = $('#flightMode').val();
      const startPoint = polygon[0];

      this.points = _wayPoints(initialHeading, gridInterval, startPoint);
      this.polyline = L.polyline(this.points, {color: 'yellow'}).addTo(map);
      const pathTurf = new Array();
      $.each(this.points, (i, v) => pathTurf.push([v.lng, v.lat]));
      if (flightMode == 'grid') {
        this.pointsGrid = _wayPoints(initialHeading + 90, gridInterval, this.points[this.points.length - 1]);
        this.polylineGrid = L.polyline(this.pointsGrid, {color: '#4ff'}).addTo(map);
        $.each(this.pointsGrid, (i, v) => pathTurf.push([v.lng, v.lat]));
      }
      const distance = Math.ceil(turf.length(turf.lineString(pathTurf)) * 1000);
  		const speed = $('#speed').val();
  		const flightTime = distance / speed // flight time
  						+ (pathTurf.length * 3) // +3sec per 1 waypoint
  						+ $('#height').val() * 2 / 3; // assume ascend/descend speed: 3m/s

      $('#distance').val(distance);
  		$('#flightTime').val(Math.ceil(flightTime / 60));

      //calculate waypoints
      function _wayPoints(baseHeading, gridInterval, startPoint) {
        let pointZero = null;
        const pointsPlus = new Array();
        const pointsMinus = new Array();
        const result = new Array();

        //find waypoints
        let prevPoint = polygon[0];
        let prevLine = 1000 * (turf.distance(turfPoint(startPoint), turfPoint(polygon[0])) * Math.sin((turf.bearing(turfPoint(startPoint), turfPoint(polygon[0])) - baseHeading) / 180 * Math.PI))  / gridInterval;
        for (let i = 1; i <= polygon.length; i++) {
          const point = (i == polygon.length) ? polygon[0] : polygon[i];
          const distance = 1000 * turf.distance(turfPoint(prevPoint), turfPoint(point));
          const heading = turf.bearing(turfPoint(prevPoint), turfPoint(point));
          const projectedDistance = 1000 * turf.distance(turfPoint(startPoint), turfPoint(point)) * Math.sin((turf.bearing(turfPoint(startPoint), turfPoint(point)) - baseHeading) / 180 * Math.PI);
          const line = projectedDistance / gridInterval;

          let start = prevLine;
          let end = line;
          let from = prevPoint;
          let to = point;
          if (start > end) {
            [start, end] = [end, start];
            [from, to] = [to, from];
          }

          const direction = turf.bearing(turfPoint(from), turfPoint(to));
          let step = Math.abs(gridInterval / Math.sin((baseHeading - heading) / 180 * Math.PI));
          if (!isFinite(step)) step = 0;
          const offset = (Math.ceil(start) - start) * step;
          start = Math.ceil(start);

          for (let j = 0; j <= (end - start); j++) {
            const positionJson =  turf.destination(turfPoint(from), (step * j + offset) / 1000, direction);
            const position = L.latLng(positionJson.geometry.coordinates[1], positionJson.geometry.coordinates[0]);

            const lineNumber = j + start;
            if (lineNumber == 0) {
              if (1000 * turf.distance(turfPoint(startPoint), turfPoint(position)) > 1) {
                pointZero = position;
              }
            }
            else if (lineNumber > 0) {
              if(pointsPlus[lineNumber]) {
                if (pointsPlus[lineNumber][0].lat > position.lat) {
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
              const index = -1 * lineNumber;
              if(pointsMinus[index]) {
                if (pointsMinus[index][0].lat > position.lat) {
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

        //reorder points
        let fromFar = true;
        result.push(startPoint);
        if (pointZero !== null) {
          result.push(pointZero);
          if (pointZero.lat > startPoint.lat) {
            fromFar = false;
          }
        }
        const order = (pointsPlus.length > pointsMinus.length) ? [pointsMinus, pointsPlus] : [ pointsPlus, pointsMinus];
        $.each(order, function(i, val) {
          let pop = false;
          for (let i = 1; i < val.length; i++) {
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

        return result;
      }
    }
  }

  function downloadCSV() {
    const csv = new Array();
		csv.push('latitude,longitude,altitude(m),heading(deg),curvesize(m),rotationdir,gimbalmode,gimbalpitchangle,actiontype1,actionparam1,actiontype2,actionparam2,actiontype3,actionparam3,actiontype4,actionparam4,actiontype5,actionparam5,actiontype6,actionparam6,actiontype7,actionparam7,actiontype8,actionparam8,actiontype9,actionparam9,actiontype10,actionparam10,actiontype11,actionparam11,actiontype12,actionparam12,actiontype13,actionparam13,actiontype14,actionparam14,actiontype15,actionparam15');
		const altitude = parseFloat($('#height').val());
		const curvesize = '0.2';
		let cameraHeading = parseFloat($('#initialDirection').val()) + parseFloat($('#cameraDirection').val());
		if (cameraHeading > 360) cameraHeading -= 360;

    $.each(path.points, (i, v) => {
      csv.push(v.lat + ',' + v.lng + ',' + altitude + ',' + cameraHeading + ',' + curvesize + ',0,0,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0');
    });

		if (path.pointsGrid.length > 0) {
			cameraHeading += 90;
			if (cameraHeading > 360) cameraHeading -= 360;

			//append one waypoint for quick rotation
			const distance = ($('#speed').val() < 1) ? 1 : $('#speed').val();
      if (distance < 1000 * turf.distance(turfPoint(path.pointsGrid[0]), turfPoint(path.pointsGrid[1]))) {
        const direction = turf.bearing(turfPoint(path.pointsGrid[0]), turfPoint(path.pointsGrid[1]));
        const newPoint = turf.destination(turfPoint(path.pointsGrid[0]), distance / 1000, direction);
				csv.push(newPoint.geometry.coordinates[1] + ',' + newPoint.geometry.coordinates[0] + ',' + altitude + ',' + cameraHeading + ',' + curvesize + ',0,0,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0');
			}

      for (let i = 1; i < path.pointsGrid.length; i++) {
        csv.push(path.pointsGrid[i].lat + ',' + path.pointsGrid[i].lng + ',' + altitude + ',' + cameraHeading + ',' + curvesize + ',0,0,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0');
      };
		}

    //download file
    const $a = $('<a>').appendTo('body')
    .css('display', 'none')
    .attr('href', window.URL.createObjectURL(new Blob([csv.join('\n')])))
    .attr('download', 'flightPlan.csv');
    $a[0].click();
    $a.remove();
	}

  //L.latLng to turfPoint
  function turfPoint (latlng) {
    return turf.point([latlng.lng, latlng.lat]);
  }
});
