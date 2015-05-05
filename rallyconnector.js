/**
 * PMO Report
 * @author Simon Tiu
 * @description This is a PMO report prototype
 * @version 1.0.0
 */

var templates = {
    template1: Handlebars.compile(document.getElementById('item-template').innerHTML),
    template2: Handlebars.compile(document.getElementById('release-template').innerHTML),
    point: Handlebars.compile(document.getElementById('point').innerHTML),
    hlsTemplate: Handlebars.compile(document.getElementById('hls-template').innerHTML)
};

// Start: Configuration for development ===============================================================
var apikey = "_Tgxq2pPzSNSlrvt2fapH0YW1bc5okjFhvj5ortDJas"; // Rally API Key for workspace
var workspace = "19718879730"; // ID for the workspace
var project = "25211977995"; // ID for the project
// End: Configuration for development =================================================================
// ====================================================================================================

// Angular App
var myApp = angular.module('pmoReport', []);

myApp.config(function($interpolateProvider) {
  $interpolateProvider.startSymbol('((');
  $interpolateProvider.endSymbol('))');
});

// list of dependencies
myApp.controller('MainCtrl',['$scope', '$http','$q', '$anchorScroll', '$location', function($scope, $http, $q, $anchorScroll, $location) {

    /**
     * This is the main function to make API calls. It will store the data to the model based on the type
     * @param  {String} type            The type of data to be queries. (see hlsString, epicString, etc.)
     * @param  {int} startingIndex      The starting index of the page
     * @param  {promise} deferred       Promise resolution object
     */
    $scope.queryArtifactsAndStore = function(type, startingIndex, deferred) {
        if(!deferred) { // defining promise for downstream resolution
            var deferred = $q.defer();
        }

        var startIndex = startingIndex || 1; // Default to 1 if starting index has not been provided
        // console.log('calling '+type+ " - "+startIndex);
        // construct URL String
        var url = "https://rally1.rallydev.com/slm/webservice/v2.0/" + type;
        var fetchArray = [ // fetching parameters
                "FormattedID",
                "ObjectID",
                "Name",
                "ScheduleState",
                "State",
                "PreliminaryEstimate",
                "ActualStartDate",
                "Children",
                "Iteration",
                "Tags",
                "Parent",
                "Project",
                "Description",
                "Release",
                "Epic",
                "PlannedStartDate",
                "PlannedEndDate",
                "StartDate",
                "EndDate",
                "PlanEstimate",
                "Ready"
        ];

        // configuration object for http calls
        var config = {
            params : {
                "workspace" : "https://rally1.rallydev.com/slm/webservice/v2.0/workspace/" + workspace,
                "query" : "",
                // "fetch" : fetchArray.toString(),
                "fetch" : true,
                "start" : startIndex,
                "pagesize" : 200,
                "project" : "https://rally1.rallydev.com/slm/webservice/v2.0/project/" + project,
                "projectScopeDown" : true,
                "projectScopeUp" : false,
                "key": "ae437b95-d241-4320-ad81-bd0681947c89"
            },
            headers : {
                "zsessionid": apikey
            }
        };

        // the http call, this is a promise
        $http.get(url, config)
            .success(function(data, status, headers, config) {
                // console.log(type +" | Success", data);

                // If there is left over data on subsequent pages, then make another call and grab that data.
                if(data.QueryResult.Results.length == config.params.pagesize) {
                    $scope.loadingProgress += Math.floor(60 * (config.params.pagesize / data.QueryResult.TotalResultCount));
                    $scope.queryArtifactsAndStore(type, (startingIndex || 0)+config.params.pagesize, deferred); // another promise
                }
                else { // If we have grabbed all the data, resolve the promise with the correct data response
                    // This is the resolve!
                    var returnValue = data;

                    deferred.resolve(returnValue);
                }

            })
            .error(function(data, status, headers, config){ // Error handler
                console.log('Error',status);
                $scope.loadingScreenDetails.push("[Error] : Loading Data Failed");
                return deferred.reject();
            });

        return deferred.promise;
    };

    $scope.init = function() {
        $scope.RL = []; // list of release lines

        // Make the data call
        $q.all([
            $scope.queryArtifactsAndStore("release"), // first get releases
            $scope.queryArtifactsAndStore("PortfolioItem/Epic"), // then get hls
            $scope.queryArtifactsAndStore("PortfolioItem/HighLevelScope"), // then get hls
            $scope.queryArtifactsAndStore("iteration")
                ]).then(function(data){
                    // console.log("------------ All data has been loaded");

                    $scope.releases = data[0].QueryResult.Results; //
                    $scope.releasesFiltered = filterReleases($scope.releases);

                    $scope.epicData = data[1].QueryResult.Results;
                    $scope.hlsData = data[2].QueryResult.Results;
                    $scope.iterationData = data[3].QueryResult.Results;

                    $scope.buildTimeline();
                },
                function(error) {
                    console.log("[Error] : Something went wrong with initial data load, please restart");
                });

    };

    // Function to render timeline: this is done by creating items and organizing them in groups.
    $scope.buildTimeline = function() {

        // Get epic data in timeline format
        var results = $scope.epicToTimelineFormat($scope.epicData);
        $scope.data = results[0]; // contains only epics

        // Get rid of redundancies
        var uniqueEpicGroups = _.uniq($scope.data, 'group');
        var groupsRaw = [];
        var hlsItemArray = [];

        // Build HLS groups
        for(var i=0; i< uniqueEpicGroups.length; i++) {
            groupsRaw.push({
                id: uniqueEpicGroups[i].group,
                content: uniqueEpicGroups[i].hlsName,
                subgroupOrder: function (a,b) {
                    return a.subgroupOrder - b.subgroupOrder;
                }

            });
        }

        for(var j=0; j<$scope.data.length; j++) {
            var currentEpic = $scope.data[j];
            var currentHLSIndex = _.findIndex(hlsItemArray, {content: currentEpic.hlsRealName});

            if(currentHLSIndex === -1){
                hlsItemArray.push({
                    content: currentEpic.hlsRealName,
                    start: currentEpic.start,
                    end: currentEpic.end,
                    group: currentEpic.group,
                    template: 'hlsTemplate',
                    style: "background-color: rgba(24, 51, 163, 0.83); color: white; border-width:0; height:27px",
                    subgroupOrder:0,
                    subgroup: 'hls',
                    detailLink: buildReferenceLink(_.where($scope.hlsData, {FormattedID: currentEpic.hlsName})[0])
                });
            }
            else {
                var hlsToBeEdited = hlsItemArray[currentHLSIndex];
                // need to compare dates
                // check if start date is before
                if(moment(currentEpic.start).isBefore(hlsToBeEdited.start)){
                    hlsToBeEdited.start = currentEpic.start;
                }
                // check if end date if after
                if(moment(currentEpic.end).isBefore(hlsToBeEdited.end)){
                    hlsToBeEdited.end = currentEpic.end;
                }
            }
        }
        $scope.hlsItemArray = hlsItemArray;
        // hlsItemArray now contains all HLS items


        // Build group for sprints
        groupsRaw.push({
            id:0,
            content: "Sprints"
        });

        var groups = new vis.DataSet(groupsRaw);

        // add sprints to data items
        for(var i=0;i<$scope.iterationData.length;i++) {
            var name = $scope.iterationData[i].Name;
            // JUST GET ELA SPRINT DATA
            var nameArr = name.split(" ");
            if(nameArr && nameArr[0].toUpperCase()==="ELA"){
                var iterationNumber = name.match(/\d+$/)[0];

                $scope.data.push({
                content: "Sprint " + iterationNumber,
                start: moment($scope.iterationData[i].StartDate).format('YYYY-MM-DD'),
                end: moment($scope.iterationData[i].EndDate).format('YYYY-MM-DD'),
                group: 0,
                template: "template2",
                style: "background-color: rgba(61, 63, 71, 0.85); color: white; border-width:0; height:27px"
            });
            }
        }
        // data now contains iterations and epics
        $scope.data = hlsItemArray.concat($scope.data, results[1]); // add hls and release data
        // data now contains iterations, epics, hls, and release

        // create data and a Timeline
        var container = document.getElementById('visualization');
        var items = new vis.DataSet($scope.data); // insert the data
        var options = { // configuration options
            zoomable: false,
            moveable: true,
            editable: false,
            selectable: false,
            template: function(item) {
                if(!item.template){
                    return null;
                }
                var template = templates[item.template];
                return template(item);
            },
            groupOrder: function (a, b) {
              return a.id - b.id;
            },
            orientation: 'top',
            stack: false
        };
        $scope.timeline = new vis.Timeline(container, items, options);

        // add release lines
        for(var i=0;i<$scope.releasesFiltered.length;i++){
            // console.log('add'+ moment($scope.releasesFiltered[i].ReleaseDate).format('YYYY-MM-DD'));
            var timelineID = $scope.timeline.addCustomTime(moment($scope.releasesFiltered[i].ReleaseDate).format('YYYY-MM-DD'), "releaseline"+(i+1));
            $scope.RL.push({
                id: timelineID,
                correctTime: $scope.timeline.getCustomTime(timelineID)
            });
        }
        $scope.timeline.setGroups(groups);
        $scope.timeline.fit();
        drawReleaseDates();

        $scope.timeline.on('timechanged',function(properties){
            var currentID = properties.id;
            var oldRecord = _.where($scope.RL, {id: currentID})[0];
            $scope.timeline.setCustomTime(oldRecord.correctTime, currentID);
        });

    };

    var filterReleases = function(releases) {
        var returnArray = [];
        returnArray = _.filter(releases, function(data) {
            // just get ERMO
            // return data.Name.substring(data.Name.length-12, data.Name.length).toUpperCase() === "ERMO RELEASE";
            return true;
        });
        returnArray = _.uniq(returnArray, 'Name'); // flattej
        returnArray = _.sortBy(returnArray, 'ReleaseDate');
        return returnArray;
    };

    // This functiont will also purge epics with no release
    $scope.epicToTimelineFormat = function(release){
        var epicItems = [];
        var releaseItems = []

        angular.forEach(release, function(d,index) {
            if(d.PlannedStartDate && d.PlannedEndDate && d.Release && d.Parent){
                var parentHLS = _.where($scope.hlsData, {_refObjectUUID: d.Parent._refObjectUUID})[0];
                // console.log('done: ',d.PercentDoneByStoryCount);
                epicItems.push({
                    id : index,
                    name: d.Name,
                    content : d.FormattedID,
                    hlsName: parentHLS.FormattedID,
                    hlsRealName: parentHLS.Name,
                    detailLink: buildReferenceLink(d),
                    // description: d.Description,
                    start : moment(d.PlannedStartDate).format('YYYY-MM-DD'),
                    end : moment(d.PlannedEndDate).format('YYYY-MM-DD'),
                    percentDone: parseInt(100*d.PercentDoneByStoryCount),
                    percentIncomplete: 100-parseInt(100*d.PercentDoneByStoryCount),
                    committed: 50,
                    planned: 40,
                    accepted: 10,
                    group: d.Parent._refObjectUUID,
                    subgroup: d.FormattedID.substr(4),
                    subgroupOrder: 1,
                    template: "template1",
                    style:"height:60px; border-width:0;"
                });

                // push release dates as well
                var currentRelease = _.where($scope.releases,{_refObjectUUID: d.Release._refObjectUUID})[0];
                releaseItems.push({
                    content: currentRelease.Name,
                    id: "release"+index,
                    type: 'point',
                    group: d.Parent._refObjectUUID,
                    start: currentRelease ? moment(currentRelease.ReleaseDate).format('YYYY-MM-DD') : null,
                    template: 'point'
                });
            }
        });
        return [epicItems, releaseItems];
    };

    /**
     * A rather complicated function to draw the release dates
     * @return {[type]} [description]
     */
    var drawReleaseDates = function() {
        for(var i=0;i<$scope.releasesFiltered.length;i++){
            var title = "Time: "+ moment($scope.timeline.getCustomTime('releaseline'+(i+1))).format('dddd, MMMM Do YYYY') + ", 0:00:00";
            var release = $scope.releasesFiltered[i].Name.split(" ");
            var releaseName = release[1];
            if(_.contains(release,"ERMO")){
                $(".customtime[title='"+title+"']").addClass('quarterlyRelease');
                $(".customtime[title='"+title+"']").prepend("<span>&nbsp;&nbsp;<strong>"+releaseName+"</strong></span>");
            }
        }
    };

    // function to build details link
    var buildReferenceLink = function(obj) {
        var baseURL = "https://us1.rallydev.com/#/";
        var type = obj._type;
        var refID = obj.ObjectID;
        var project = obj.Project._ref.split("/");
        var projectID = project[project.length-1];
        var addOn = "";

        if(type === "PortfolioItem/HighLevelScope"){
            addOn = "/detail/portfolioitem/highlevelscope/" + refID;
        }
        else if(type === "PortfolioItem/Epic"){
            addOn = "/detail/portfolioitem/epic/" + refID;
        }
        else {
            addOn = "/detail/userstory/"+ refID;
        }
        return baseURL + projectID + addOn;
    };

    $scope.init();
}]);













