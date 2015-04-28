
var templates = {
    template1: Handlebars.compile(document.getElementById('item-template').innerHTML),
    template2: Handlebars.compile(document.getElementById('release-template').innerHTML)
};

/**
 * PMO Report
 * @author Simon Tiu
 * @description This is a PMO report
 * @version 1.0.0
 */

// Start: Configuration for development ===============================================================
var apikey = "_Tgxq2pPzSNSlrvt2fapH0YW1bc5okjFhvj5ortDJas"; // Rally API Key for workspace

// Project list for display. Projects listed here will be displayed on the PKB in this order.
// This must be configured beforehand.
var projectList = [
    {
        _ref: "https://rally1.rallydev.com/slm/webservice/v2.0/project/25109541415",
        refShort: "/project/25109541415",
        _refObjectName: "Smart Account + User Management",
    },
    {
        _ref: "https://rally1.rallydev.com/slm/webservice/v2.0/project/25109543613",
        refShort: "/project/25109543613",
        _refObjectName: "Usage",
    },
    {
        _ref: "https://rally1.rallydev.com/slm/webservice/v2.0/project/25109543887",
        refShort: "/project/25109543887",
        _refObjectName: "Fulfillment",
    },
    {
        _ref: "https://rally1.rallydev.com/slm/webservice/v2.0/project/25110404377",
        refShort: "/project/25110404377",
        _refObjectName: "ELA",
    },
    {
        _ref: "https://rally1.rallydev.com/slm/webservice/v2.0/project/29236251005",
        refShort: "/project/29236251005",
        _refObjectName: "Software Convergence",
    },
    {
        _ref: "https://rally1.rallydev.com/slm/webservice/v2.0/project/29236391259",
        refShort: "/project/29236391259",
        _refObjectName: "New Classic & Smart License Capabilities",
    }
];

// End: Configuration for development ===============================================================
// ==================================================================================================

// Angular App
var myApp = angular.module('pmoReport', []);

myApp.config(function($interpolateProvider) {
  $interpolateProvider.startSymbol('((');
  $interpolateProvider.endSymbol('))');
});

// list of dependencies
myApp.controller('MainCtrl',['$scope', '$http','$q', '$anchorScroll', '$location', function($scope, $http, $q, $anchorScroll, $location) {

    s = $scope;

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
        console.log('calling '+type+ " - "+startIndex);
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
                "workspace" : "https://rally1.rallydev.com/slm/webservice/v2.0/workspace/19718879730",
                "query" : "",
                // "fetch" : fetchArray.toString(),
                "fetch" : true,
                "start" : startIndex,
                "pagesize" : 200,

                "key": "ae437b95-d241-4320-ad81-bd0681947c89"
            },
            headers : {
                "zsessionid": apikey
            }
        };

        // the http call, this is a promise
        $http.get(url, config)
            .success(function(data, status, headers, config) {
                console.log(type +" | Success", data);

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
        // Make the data call
        $q.all([
            $scope.queryArtifactsAndStore("release"), // first get releases
            $scope.queryArtifactsAndStore("PortfolioItem/HighLevelScope") // then get hls
                ]).then(function(data){
                    console.log("------------ All data has been loaded");

                    $scope.releases = data[0].QueryResult.Results; //
                    $scope.releasesFiltered = filterReleases($scope.releases);
                    $scope.hlsData = data[1].QueryResult.Results;

                    if($scope.releasesFiltered.length < 4) {
                        showError("Not enough release data has been set in Rally to build board (must have at least 4 releases)");
                    }
                    else {
                        setDate($scope.releases);
                    }

                    $scope.buildTimeline();
                },
                function(error) {
                    console.log("[Error] : Something went wrong with initial data load, please restart");
                });

    };

    $scope.RL = [];
    $scope.buildTimeline = function() {

        var data = $scope.transformHLSDataToTimelineFormat($scope.hlsData);

        var groups = new vis.DataSet([
            {
                id:0,
                content: "Releases"
            },
            {
                id:1,
                content: 'HLS'
            }
        ]);
        for(var i=1;i<$scope.releasesFiltered.length;i++) {
            //console.log(i);
            data.push({
                content: $scope.releasesFiltered[i].Name,
                start: moment($scope.releasesFiltered[i-1].ReleaseDate).format('YYYY-MM-DD'),
                end: moment($scope.releasesFiltered[i].ReleaseDate).format('YYYY-MM-DD'),
                group: 0,
                template: "template2"
            });
        }

        // create a couple of HTML items in various ways
        // create data and a Timeline
        var container = document.getElementById('visualization');
        var items = new vis.DataSet(data);
        var options = {
            zoomable: false,
            showCustomTime: true,
            selectable: false,
            template: function(item) {
                var template = templates[item.template];
                return template(item);
            },
            groupOrder: function (a, b) {
              return a.id - b.id;
            }
        };
        $scope.timeline = new vis.Timeline(container, items, options);

        for(var i=0;i<$scope.releasesFiltered.length;i++){
            console.log('add'+ moment($scope.releasesFiltered[i].ReleaseDate).format('YYYY-MM-DD'));
            $scope.RL.push($scope.timeline.addCustomTime(moment($scope.releasesFiltered[i].ReleaseDate).format('YYYY-MM-DD'), "releases"+(i+1)));
        }
        $scope.timeline.setGroups(groups);


    };

    var filterReleases = function(releases) {
        var returnArray = [];
        returnArray = _.filter(releases, function(data) {
            // just get ERMO
            return data.Name.substring(data.Name.length-12, data.Name.length).toUpperCase() === "ERMO RELEASE";
        });

        returnArray = _.uniq(returnArray, 'Name'); // flattej
        returnArray = _.sortBy(returnArray, 'ReleaseDate');
        return returnArray;
    };

    var setDate = function(releases) {
        $scope.now = moment(); // get today

        // get the next three releaes dates and the start date of the current release schedule
        var counter = 0;
        $scope.releaseDates = [];
        for(var i=0, len=$scope.releases.length; i<len; i++) {
            var thisReleaseDate = moment($scope.releases[i].ReleaseDate);
            if($scope.now.isAfter(thisReleaseDate)){
                counter++;
                $scope.releaseDates.push(thisReleaseDate.format('MMMM Do YYYY'));

                if(counter >= 4){
                    break;
                }
            }
        }
        console.log(counter);
    };

    $scope.transformHLSDataToTimelineFormat = function(release){
        var returnArray = [];

        angular.forEach(release, function(d,index) {
            if(d.PlannedStartDate && d.PlannedEndDate){
                returnArray.push({
                id : index,
                name: d.Name,
                content : d.FormattedID,
                description: d.Description,
                start : moment(d.PlannedStartDate).format('YYYY-MM-DD'),
                end : moment(d.PlannedEndDate).format('YYYY-MM-DD'),
                committed: 50,
                planned: 40,
                accepted: 10,
                group: 1,
                template: "template1"
                });
            }
        });
        return returnArray;
    };

    var showError = function(message) {
        $scope.errorMessage = message;
        $('#errorModal').modal('show');
    };

    $scope.init();
}]);

myApp.directive('hlsTicket', function() {
    return {
        templateUrl: "ticket.html"
    };
});














