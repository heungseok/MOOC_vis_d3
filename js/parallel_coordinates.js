/**
 * Created by heungseok2 on 2017-07-26.
 */



function init_parcoords() {

    // load csv file and create the chart
    d3.csv('./data/MOOC_parcoord_data_only_net_available.csv', function(data) {


        // 데이터 extract by time, review platform
        par_data = _.where(data, {review_platform: platform, time:String(current_time), session_open:"TRUE"});
        console.log(par_data);

        var colorgen = d3.scale.ordinal()
            .range(["#862a31","#2d8d2d","#7e552c","#767c2b",
                "#7e4b2c","#284562","#342f69","#702a70",
                "#4d3275","#250751","#ffff99","#b15928"]);

        var color = function(d) { return colorgen(d.area); };

        parcoords
            .data(par_data)
            .hideAxis(["course_id", "provider", "review_platform", "title", "school", "subject", "price", "level",
                "course_length", "effort_hours", "published_time", "time", "session_open", "url",
                "low rating ratio",	"mid rating ratio",	"high rate ratio", "helpfulness score (ratio)",
                "indegree", "outdegree"
            ])
            .color(color)
            .alpha(0.25)
            .composite("darken")
            .margin({ top: 24, left: 150, bottom: 12, right: 0 })
            .mode("queue")
            .render()
            .reorderable()
            .brushMode("1D-axes");  // enable brushing

        parcoords.svg.selectAll("text")
            .style("font", "10px sans-serif");
    });
    
}

function clearPC(){
    console.log("clear PC!");
    d3.select("#pc-container").select("svg").remove();
    $('#pc-container>canvas').remove();

}

function updatePC() {
    clearPC();
    parcoords = d3.parcoords()("#pc-container")
    init_parcoords(); // global에 전체 데이터를 저장하는 것 보다는 그냥 새로 불러들이는게 나을거같음.

}
