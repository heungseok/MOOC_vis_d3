
var width = document.getElementById("d3_container").offsetWidth,
    height = document.getElementById("d3_container").offsetHeight;

var svg = d3.select("#d3_container").append("svg"),
    // width = +svg.attr("width"),
    // height= +svg.attr("height"),
    g = svg.append("g"),
    transform = d3.zoomIdentity;


var color = d3.scaleOrdinal(d3.schemeCategory20);

var x = d3.scaleLinear().range([0, width]);
var y = d3.scaleLinear().range([height, 0]);

var line = d3.line()
    // .curve(d3.curveMonotoneX)
    // .x(function(d){ console.log(d); return x(d)})
    // .y(function(d){ return y(d)});

var nodes,
    links;


/*
 json data import and push to network array
 */
$(document).ready(function(){
    initD3();
});


function initD3(){

    // d3.json("./data/modularity_k4_CPM_perf_log_t3_cc.json", function(error, graph){
    d3.json("./data/C19_color_encoded(good3).json", function(error, graph){
        console.log(graph);

        nodes = graph.nodes.map(function(d){
            return {
                'index' : d.id,
                'x' : d.x,
                'y' : d.y,
                'label' : d.attributes.area,
                'color': d.color
            }
        });

        // set the x, y domain using _.pluck
        // var x0 = _.pluck(graph.nodes, 'x');
        // var y0 = _.pluck(graph.nodes, 'y');
        var x0 = d3.extent(nodes, function(d){ return d.x;});
        var y0 = d3.extent(nodes, function(d){ return d.y;})

        // 상화좌우로 100씩 확장.
        // x.domain([ x0[0]-1000, x0[1]+1000 ]);
        // y.domain([ y0[0]-1000, y0[1]+1000 ]);
        x.domain(x0);
        y.domain(y0);
        // y.domain(d3.extent(nodes, function(d){ return d.y;}));


        links = graph.edges.map(function(d){
            return {
                'source': d.source,
                'target': d.target,
                'color': d.color

            }
        });

/*
        // draw each edge using line
        g.append("g")
            .attr("class", "edges")
            .attr("stroke", "#000")
            .attr("stroke-width", 0.5)
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("stroke", function(d) { return d.color; })
            .attr("x1", function(d) { return x(findNodePositionX(d.source)); })
            .attr("y1", function(d) { return y(findNodePositionY(d.source)); })
            .attr("x2", function(d) { return x(findNodePositionX(d.target)); })
            .attr("y2", function(d) { return y(findNodePositionY(d.target)); });
*/

        // draw each edge using path
        g.append("g")
            .attr("class", "edges")
            .attr("stroke", "#000")
            .attr("stroke-width", 0.5)
            .selectAll("line")
            .data(links)
            .enter().append("path")
            .attr("class", "line")
            .attr("stroke", function(d) { return d.color; })
            .attr("d", function(d) { return line( [
                [x(findNodePositionX(d.source)), y(findNodePositionY(d.source))],
                [x(findNodePositionX(d.target)), y(findNodePositionY(d.target))]
            ])});

        g.append("g")
            .attr("class", "nodes")
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.01)
            .selectAll("circle")
            .data(nodes)
            .enter().append("circle")
            .attr("fill", function(d) { return d.color; })
            .attr("cx", function(d) { return x(d.x); })
            .attr("cy", function(d) { return y(d.y); })
            .attr("r", 2.5)
            .call(d3.drag()
                .on("drag", dragged));

        svg.call(d3.zoom()
            .scaleExtent([1 / 2, 8])
            .on("zoom", zoomed))

    });

}
function zoomed(){
    g.select("g.nodes").attr("transform", d3.event.transform);
    g.select("g.edges").attr("transform", d3.event.transform);
}

function dragged(d){
    d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
}


function findNodePositionX(id){
    var temp_x = _.where(nodes, {index: id});
    return temp_x[0].x;
}
function findNodePositionY(id){
    var temp_y = _.where(nodes, {index: id});
    return temp_y[0].y;
}


function initD3_withForce(){
    // d3.json("./data/modularity_k4_CPM_perf_log_t3_cc.json", function(error, graph){
    d3.json("./data/C19_color_encoded(good3).json", function(error, graph){
    // d3.json("./data/t1_classCentral_network.json", function(error, graph){
        console.log(graph);

/*
        nodes = graph.nodes.map(function(d){
            return {
                'index' : d.id,
                'x' : d.x,
                'y' : d.y,
                // 'label' : d.attributes.area
            }
        });
*/


        // set the x, y domain using _.pluck
        // var x0 = _.pluck(graph.nodes, 'x');
        // var y0 = _.pluck(graph.nodes, 'y');
        // x.domain(d3.extent(nodes, function(d){ return d.x;}));
        // y.domain(d3.extent(nodes, function(d){ return d.y;}));


        var link_svg = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graph.edges)
            .enter().append("line")
            .attr("stroke-width", function(d) { return Math.sqrt(d.size); });

        var node_svg = svg.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(graph.nodes)
            .enter().append("circle")
            .attr("r", 5)
            .attr("fill", function(d) { return d.color; })

        node_svg.append("title")
            .text(function(d) { return d.id; });

        simulation
            .nodes(graph.nodes)
            .on("tick" ,ticked)

        simulation.force("link")
            .links(graph.edges)

        function ticked(){
            link_svg
                .attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });

            node_svg
                .attr("cx", function(d) { return d.x; })
                .attr("cy", function(d) { return d.y; });
        }

        console.log("node, link parsing finished")

    });

}

function init() {

    $.getJSON(url_arr[0], function(data, textStatus, jqXHR){
        network_arr.push(data);
        sigma_init(network_arr[0]);

    });

    for(var i=1; i<url_arr.length;i++){
        requestData(i);
    }
}




// incresing Time T and changing and animating network.
function t_plus(){
    console.log("plus!");
    var source_value = parseInt(document.getElementById("min-degree").value);
    var max_value = parseInt(document.getElementById("min-degree").max);

    if(source_value < max_value){
        var target_value = source_value+1;
        current_time = target_value;
        document.getElementById("min-degree").value = target_value;

        // network update
        showValue(target_value);
        changeNetwork(source_value, target_value);

        // parallel coordinates update
        updatePC();

    }
}



// decreasing Time T and changing and animating network.
function t_minus(){


    var source_value = parseInt(document.getElementById("min-degree").value);
    var min_value = parseInt(document.getElementById("min-degree").min);

    if(source_value>min_value){
        // console.log(source_value);
        var target_value = source_value-1;
        current_time = target_value;
        document.getElementById("min-degree").value = target_value;
        showValue(target_value);

        changeNetwork(source_value, target_value);
        updatePC();
    }
}


// automatically increasing degree and changing network
function t_play(){
    var flag = false;
    var timerId = 0 ;

    var source_value = parseInt(document.getElementById("min-degree").value);
    var max_value = parseInt(document.getElementById("min-degree").max);

    var length = max_value-source_value;

    // automatically increasing degree and changing network
    timerId = setInterval(function(){
        if(source_value >= max_value || parseInt(document.getElementById("current_date").innerHTML) >= max_value){
            clearInterval(timerId);
        }else{
            source_value++;
            document.getElementById("min-degree").value = source_value;
            showValue(source_value);
            changeNetwork(source_value-1, source_value);
            updatePC();
        }

    },2000);

}


// show the value of the degree bar
function showValue(newValue)
{
    document.getElementById("current_date").innerHTML=newValue;
    document.getElementById("time_period").innerHTML=time_period_map[newValue];

}


// reset degree
function t_reset() {

    var source_value = parseInt(document.getElementById("min-degree").value);
    if(source_value != 1){
        document.getElementById("min-degree").value = 1;
        current_time = 1;
        showValue(1);
        changeNetwork(source_value, 1);
        updatePC();
    }
}


function switchPlatform(btn_platform) {
    var targetPlatform = btn_platform.innerHTML;

    if(targetPlatform !== platform){
        console.log("switch review platform from-" + platform + " to-" + targetPlatform);
        platform = targetPlatform;
        current_time = 1;
        document.getElementById("min-degree").value = current_time;
        showValue(1);
        cleanNetwork();
        clean_networkCanvas();
        switchNetwork();
        updatePC();
    }
    // 같을 경우 do nothing;
}
