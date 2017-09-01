var root_fileName = "C19_color_encoded_";
var network_fileName = "C19_color_encoded_YifanHu.json";


var width = document.getElementById("d3_container").offsetWidth,
    height = document.getElementById("d3_container").offsetHeight;

var svg = d3.select("#d3_container").append("svg"),
    g = svg.append("g"),
    transform = d3.zoomIdentity,
    zoom = d3.zoom().scaleExtent([0.5, 8]).on("zoom", zoomed);


var x = d3.scaleLinear().range([0, width]);
var y = d3.scaleLinear().range([height, 0]);

var line = d3.line()
    // .curve(d3.curveMonotoneX)
    // .x(function(d){ console.log(d); return x(d)})
    // .y(function(d){ return y(d)});


// *********** Network Variable: Layout, Community, Nodes, Edges ********** //
// var layout = "YifanHu";
var layout = "ForceAtlas";
var size_mode = "overlap_num";
// var size_mode = "performance";
var color_mode = "community";


var communities = [];

var course_info;
var nodes, overlapping_nodes, links;

var current_time = 3;
var current_platform = "classCentral";

var color_by_communities = [];
var getCommunityColor = function(d){
    for(var i=0; i<color_by_communities.length; i++){
        if(color_by_communities[i].comm_id === d){
            return color_by_communities[i].color;
        }
    }
};

// color palette
var area_color = d3.scaleOrdinal(d3.schemeCategory10);
var betRank_color = d3.scaleThreshold().range(d3.schemeRdPu[9]);
var transRank_color = d3.scaleThreshold().range(d3.schemeYlOrRd[9]);
var mixRank_color = d3.scaleThreshold(500).range(d3.schemeRdYlBu[11]);

// *********** pie element for overlapping node ********** //
var pie = d3.pie()
    .sort(null)
    .value(function(d) { return d.value; });


var pie_arc = d3.arc()
    .outerRadius(function(d) {

        if(size_mode=="overlap_num")
            return 0.001 + (+d.data.overlap_num*2);
        else if(size_mode=="performance")
            return 0.001 + (+d.data.performance);
        else if(size_mode=="betweenness")
            return 0.001 + (+d.data.betweenness*500);
    })
    .innerRadius(0);

// ************** convex hull variable, function ********************** //
var hullPadding = 10;

// Point/Vector Operations
var vecFrom = function (p0, p1) {               // Vector from p0 to p1
    return [ p1[0] - p0[0], p1[1] - p0[1] ];
};

var vecScale = function (v, scale) {            // Vector v scaled by 'scale'
    return [ scale * v[0], scale * v[1] ];
};

var vecSum = function (pv1, pv2) {              // The sum of two points/vectors
    return [ pv1[0] + pv2[0], pv1[1] + pv2[1] ];
};

var vecUnit = function (v) {                    // Vector with direction of v and length 1
    var norm = Math.sqrt (v[0]*v[0] + v[1]*v[1]);
    return vecScale (v, 1/norm);
};

var vecScaleTo = function (v, length) {         // Vector with direction of v with specified length
    return vecScale (vecUnit(v), length);
};

var unitNormal = function (pv0, p1) {           // Unit normal to vector pv0, or line segment from p0 to p1
    if (p1 != null) pv0 = vecFrom (pv0, p1);
    var normalVec = [ -pv0[1], pv0[0] ];
    return vecUnit (normalVec);
};

// Hull Generators

var lineFn = d3.line()
    .curve (d3.curveCatmullRomClosed)
    .x (function(d) { return d.p[0]; })
    .y (function(d) { return d.p[1]; });

var smoothHull = function (polyPoints) {
    // Returns the SVG path data string representing the polygon, expanded and smoothed.
    var pointCount = polyPoints.length;

    // Handle special cases
    if (!polyPoints || pointCount < 1) return "";

    var hullPoints = polyPoints.map (function (point, index) {
        var pNext = polyPoints [(index + 1) % pointCount];
        return {
            p: point,
            v: vecUnit (vecFrom (point, pNext))
        };
    });

    // Compute the expanded hull points, and the nearest prior control point for each.
    for (var i = 0;  i < hullPoints.length;  ++i) {
        var priorIndex = (i > 0) ? (i-1) : (pointCount - 1);
        var extensionVec = vecUnit (vecSum (hullPoints[priorIndex].v, vecScale (hullPoints[i].v, -1)));
        hullPoints[i].p = vecSum (hullPoints[i].p, vecScale (extensionVec, hullPadding));
    }

    return lineFn (hullPoints);
};


// ********** tooltip *************
var tooltip = d3.select("#d3_container").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);


/*
 json data import and push to network array
 */
$(document).ready(function(){

    document.getElementById("loading").style.display = "block";
    initD3();
    initUI();
});



function initD3(){

    // d3.json("./data/modularity_k4_CPM_perf_log_t3_cc.json", function(error, graph){
    // d3.json("./data/C19_color_encoded_ForceAtlas.json", function(error, graph){
    d3.json("./data/"+ root_fileName + layout + ".json", function(error, graph){

        // d3.csv("./data/MOOC_parcoord_data_only_net_available.csv", function(courses){
        d3.csv("./data/T3_node_info.csv", function(courses){
            // ****** set global layout variable and dropdown element active ***** //
            $("li."+layout).addClass("active");
            $("li."+size_mode).addClass("active");
            $("li."+color_mode).addClass("active");


            // ************* 1. Course data parsing by global time variable ************ //
            // course_info = _.where(courses, {time: String(current_time), review_platform: current_platform });
            course_info = courses;

            // ******************* color palette domain setting ****************** //
            // each color palette setting by between rank, transitivity rank, mix rank, area
            // 이와 같이 color range를 설정할 경우 isolate까지 포함하게됨.
            var area_list = _.uniq(_.pluck(course_info, "area"));
            var betRank_list = (_.pluck(course_info, "bet_rank"));
            var transRank_list = (_.pluck(course_info, "trans_rank"));
            var mixRank_list = (_.pluck(course_info, "mix_rank"));

            area_color.domain(area_list);
            betRank_color.domain(betRank_list);
            transRank_color.domain(transRank_list);
            mixRank_color.domain(mixRank_list);

            console.log(course_info);
            console.log(graph);


            nodes = graph.nodes.map(function(d){

                if(Number(d.attributes.overlap_num) > 1){
                    d.attributes.community.split("+").forEach(function (c) {
                        if(!_.contains(communities, c)){
                            communities.push(c);
                        }

                    })
                }else if(Number(d.attributes.overlap_num) < 2 && d.attributes.community != 'null'){
                    if(!_.contains(communities, d.attributes.community)){
                        communities.push(d.attributes.community)

                    }

                    if(_.findWhere(color_by_communities, { comm_id: d.attributes.community }) === undefined){
                        color_by_communities.push({comm_id:d.attributes.community, color:d.color});
                    }

                }


                var res_findWhere = _.findWhere(course_info, {url: d.attributes.name });
                if(res_findWhere !== undefined){
                    return {
                        // node info
                        'index' : d.id,
                        'x' : d.x,
                        'y' : d.y,
                        'color': d.color,

                        // 그리고 rank, centrality 등 모두 통일된 range로 스케일 조정 필수.
                        'community': d.attributes.community ,
                        'overlap_num': +d.attributes.overlap_num,
                        'performance': +d.attributes["perf_lead.log"],
                        // 'betweenness': +d.attributes["bet"],

                        // course info
                        'title': res_findWhere.title,
                        'provider': res_findWhere.provider,
                        'area': res_findWhere.area,
                        'subject': res_findWhere.subject,
                        'school': res_findWhere.school,

                        'between': +res_findWhere.between,
                        'trans': +res_findWhere.trans,
                        'bet_rank': +res_findWhere.bet_rank,
                        'trans_rank': +res_findWhere.trans_rank,
                        'mix_rank': +res_findWhere.mix_rank
                    }
                }else{

                    return {
                        // node info
                        'index' : d.id,
                        'x' : d.x,
                        'y' : d.y,
                        'color': d.color,

                        'community': d.attributes.community,
                        'overlap_num': d.attributes.overlap_num,
                        'performance': +d.attributes["perf_lead.log"],
                        // 'betweenness': +d.attributes["bet"],

                        // course info
                        'title': "unknown",
                        'area' : d.attributes.area,
                        'subject': d.attributes.subject,
                        'school': "unknown",

                        'between': 0,
                        'trans': 0,
                        'bet_rank': 0,
                        'trans_rank': 0,
                        'mix_rank': 0
                    }
                }

            });
            console.log(nodes);
            // community array sort
            communities.sort(function(a, b) { return a.replace("c", "") - b.replace("c", "") });

            // ******************* x, y range and domain setting ****************** //
            var x0 = d3.extent(nodes, function(d){ return d.x;});
            var y0 = d3.extent(nodes, function(d){ return d.y;})
            x.domain(x0);
            y.domain(y0);


            // ******************* link parsing ********************************** //
            links = graph.edges.map(function(d){
                // set edge color by betweenness, transitivity, mix rank, area
                // find node by source
                temp_node = findNodeById(d.source)[0];

                return {
                    'source': d.source,
                    'target': d.target,
                    'size': d.size,
                    'color': d.color,
                    'bet_color': betRank_color(temp_node.bet_rank),
                    'trans_color': transRank_color(temp_node.trans_rank),
                    'area_color': area_color(temp_node.area),
                    'mix_color': mixRank_color(temp_node.mix_rank)

                }
            });

            // ******************** cluster overlayed convex hull ************** //
            g.append("g")
                .attr("class", "communities")
                .attr("id", "communities")
                .selectAll("path")
                .data(communities)
                .enter().append("path")
                .attr("class", "hull")
                .attr("id", function(d) { return d; })
                .attr("fill", function(d) { return getCommunityColor(d); })
                .attr("stroke", function(d) { return getCommunityColor(d); })
                .attr('d', function(d){
                    // d is community
                    // console.log(d);
                    var points = [];
                    nodes.forEach(function (node) {
                        if(Number(node.overlap_num) > 1){
                            if(_.contains(node.community.split("+"), d))
                                points.push([x(node.x), y(node.y), node.index])
                        }else{
                            if(d == node.community)
                                points.push([x(node.x), y(node.y), node.index])
                        }
                    });
                    // console.log(points);
                    var convexHull = d3.polygonHull(points);
                    return smoothHull(convexHull);

                });

            // ******************** draw each edge using path ******************** //
            g.append("g")
                .attr("class", "edges")
                .attr("id", "edges")
                .selectAll("line")
                .data(links)
                .enter().append("path")
                .attr("class", "line")
                .attr("stroke-width", function(d) { return Math.sqrt(d.size); })
                .attr("stroke", getEdgeColor)
                .attr("d", function(d) { return line( [
                    [x(findNodePositionX(d.source)), y(findNodePositionY(d.source))],
                    [x(findNodePositionX(d.target)), y(findNodePositionY(d.target))]
                ])});

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


            // ***************  draw overlay pie chart on the node circle **************** //
            overlapping_nodes = nodes.filter(function(d) {
                if(+d.overlap_num > 1) return true;
                return false; // skip

            }).map(function(filtered_d){
                return {
                    'index' : filtered_d.index,
                    'x' : filtered_d.x,
                    'y' : filtered_d.y,
                    'overlapping_num': +filtered_d.overlap_num,
                    'overlapping_communities': filtered_d.community.split("+").map(
                        function(d){ return { "id": d, "value": 0,
                            "overlap_num": +filtered_d.overlap_num,
                            'betweenness': +filtered_d.betweenness,
                            'performance': +filtered_d.performance}; })
                }
            });
            overlapping_nodes.forEach(function(node, index){

                var from = _.pluck(_.where(links, {source: node.index}), "target");
                var to = _.pluck(_.where(links, {target: node.index}), "source");
                var neighbors = _.union(from, to);
                neighbors.forEach(function(nei){
                    var nei_commu = _.findWhere(nodes, { index: nei }).community; // 이웃 노드의 community
                    // 이웃들 중, 다른 community를 overlapping 하는 노드들도 있음. 그럴 경우 그냥 pass
                    if (nei_commu !== undefined && nei_commu !== "null" && !nei_commu.includes("+")){
                        // 각 이웃의 community가 현재 node(overlapping)의 community에 있을 경우 value ++
                        var commu_index = _.indexOf(_.pluck(node.overlapping_communities, "id"), nei_commu);
                        if(commu_index !== -1)
                            overlapping_nodes[index].overlapping_communities[commu_index].value++;
                    }
                })

            });



            var arc = g.append("g")
                .attr("class", "overlapping_nodes")
                .attr("id", "overlapping_nodes")
                .selectAll(".arc")
                .data(overlapping_nodes)
                .enter().append("g")
                .attr("class", "pie_container")
                .attr("transform", function (d) {
                    return "translate (" + x(d.x) + "," + y(d.y) + ")";
                })
                .append("g").attr("class", "pies");

            // Select each g element we created, and fill it with pie chart;
            var pies = arc.selectAll(".pies")
                .data(function (d) { return pie(d.overlapping_communities); })
                .enter()
                .append("g")
                .attr("class", "arc");

            pies.append("path")
                .attr("d", pie_arc)
                .attr("stroke-width", 0)
                .attr("stroke", "#FFF")
                .attr("fill", function(d) { return getCommunityColor(d.data.id)});

            // ******************** draw node ******************** //
            g.append("g")
                .attr("class", "nodes")
                .attr("id", "nodes")
                .selectAll("circle")
                .data(nodes)
                .enter().append("circle")
                .attr("fill", getNodeColor)
                .attr("fill-opacity", getNodeOpacity)
                .attr("cx", function(d) { return x(d.x); })
                .attr("cy", function(d) { return y(d.y); })
                .attr("r", getNodeSize)
                .on("mouseover", mouseMoveOnNode)
                .on("mouseout", mouseOutOnNode)
                .call(d3.drag()
                    .on("drag", dragged));



            // ********** Append checkboxes list by each community *********** //
            communities.forEach(function (commu) {
                // set inivisible the each convex at first
                document.getElementById(commu).style.display = "none";

                // init checked false at first
                $('ul.network.dropdown-menu').append("<li onmouseover=cb_mouseOver(this); onmouseout=cb_mouseOut(this);><a href='#'><input class='cb_network communities' type='checkbox' onchange=control_network_component(this) " +
                    "value=" + commu + "> " + commu + "</a></li>");

                // init checked true at first
                // $('ul.network.dropdown-menu').append("<li><a href='#'><input class='cb_network communities' type='checkbox' onchange=control_network_component(this); checked='checked'" +
                //     "value=" + commu + "> " + commu + "</a></li>");

            });

            // ********** Drag zoom initialize ************* //
            svg.call(zoom)
                .call(zoom.transform, d3.zoomIdentity.translate(width/6, height/10).scale(0.7));

            document.getElementById("loading").style.display = "none";
        });
    });

}

function changeLayout(target_layout){
    // 먼저 target_layout과 현재 layout 비교
    if(target_layout === layout)
        return;
    else{
        $("li."+layout).removeClass("active");
        layout = target_layout;
    }

    // ****** set global layout variable and dropdown element active ***** //
    $("li."+layout).addClass("active");

    // ****** hull and edges invisible temporarily ******* //
    document.getElementById("edges").style.display = "none";
    document.getElementById("communities").style.display = "none";

    // ****** target network file read ***** //
    d3.json("./data/"+ root_fileName + layout + ".json", function(error, graph){

        // *** change the each node's x, y coordinates *** //
        nodes.forEach(function(node, index){
            var corresponded_node = _.findWhere(graph.nodes, {id: node.index});
            if (corresponded_node === undefined)
                return;
            else{
                nodes[index].x = corresponded_node.x;
                nodes[index].y = corresponded_node.y;
            }
        });

        overlapping_nodes.forEach(function(node, index){
            var corresponded_node = _.findWhere(graph.nodes, {id: node.index});
            if (corresponded_node === undefined)
                return;
            else{
                overlapping_nodes[index].x = corresponded_node.x;
                overlapping_nodes[index].y = corresponded_node.y;
            }
        });

        // **************** d3 element update ************* //
        // **************** Node update ****************** //
        var t = d3.transition()
            .duration(1500);

        var nodes_selector = g.select("#nodes")
            .selectAll("circle")
            .data(nodes);

        nodes_selector
            .transition(t)
            .attr("cx", function(d) { return x(d.x); })
            .attr("cy", function(d) { return y(d.y); });

        // **************** Pie update ****************** //
        var pie_selector = g.select("#overlapping_nodes")
            .selectAll("g.pie_container")
            .data(overlapping_nodes);

        pie_selector
            .transition(t)
            .attr("transform", function (d) {
                return "translate (" + x(d.x) + "," + y(d.y) + ")";
            });

    });

}

function changeOthers(){

    // **************** Hull update ****************** //
    var comm_selector = g.select("#communities")
        .selectAll("path");

    comm_selector
        .attr('d', function(d){
            var points = [];
            nodes.forEach(function (node) {
                if(Number(node.overlap_num) > 1){
                    if(_.contains(node.community.split("+"), d))
                        points.push([x(node.x), y(node.y), node.index])
                }else{
                    if(d == node.community)
                        points.push([x(node.x), y(node.y), node.index])
                }
            });
            var convexHull = d3.polygonHull(points);
            return smoothHull(convexHull);

        });

    // **************** Edge update ****************** //
    var edges_selector = g.select("#edges")
        .selectAll("path");

    edges_selector
        .attr("d", function(d) { return line( [
            [x(findNodePositionX(d.source)), y(findNodePositionY(d.source))],
            [x(findNodePositionX(d.target)), y(findNodePositionY(d.target))]
        ])});


    // ****** hull and edges invisible temporarily ******* //
    document.getElementById("edges").style.display = null;
    document.getElementById("communities").style.display = null;

}

function changeNodeSize(target_size){
    if(target_size === size_mode)
        return;
    else{
        $("li."+size_mode).removeClass("active");
        size_mode = target_size;
    }
    // ****** set global layout variable and dropdown element active ***** //
    $("li."+size_mode).addClass("active");

    var t = d3.transition()
        .duration(1700);

    // ****** change the node color by target size ****** //
    var nodes_selector = g.select("#nodes")
        .selectAll("circle");
    nodes_selector
        .transition(t)
        .attr("r", getNodeSize);
    // **************** Pie update ****************** //
    var pie_selector = g.select("#overlapping_nodes")
        .selectAll("g.pie_container").selectAll("path")
    pie_selector
        .transition(t)
        .attr("d", pie_arc);
}

function changeNodeColor(target_color){
    if(target_color === color_mode)
        return;
    else{
        $("li."+color_mode).removeClass("active");
        color_mode = target_color;
    }
    // ****** set global layout variable and dropdown element active ***** //
    $("li."+color_mode).addClass("active");

    var t = d3.transition()
        .duration(1000);

    // ****** change the node color by target color ****** //
    var nodes_selector = g.select("#nodes")
        .selectAll("circle");
    nodes_selector
        .transition(t)
        .attr("fill", getNodeColor)
        .attr("fill-opacity", getNodeOpacity);

    // ****** change the edge color by target color ****** //
    var edges_selector = g.select("#edges")
        .selectAll("path");
    edges_selector
        .transition(t)
        .attr("stroke", getEdgeColor);

}

function zoomed(){
    // console.log(d3.event.transform)
    g.select("g.nodes").attr("transform", d3.event.transform);
    g.select("g.edges").attr("transform", d3.event.transform);
    g.select("g.communities").attr("transform", d3.event.transform);
    g.select("g.overlapping_nodes").attr("transform", d3.event.transform);

}

function dragged(d){

    d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
}
// #################### Network utility ########################## //
function mouseMoveOnNode(d){

    document.getElementById("course-title").innerHTML= d.title;
    document.getElementById("course-provider").innerHTML= d.provider;
    document.getElementById("course-area").innerHTML= d.area;
    document.getElementById("course-subject").innerHTML= d.subject;
    document.getElementById("course-school").innerHTML= d.school;
    document.getElementById("course-community").innerHTML= d.community.replace(/\+/g, ", ");
    document.getElementById("course-overlapping-community").innerHTML= parseInt(d.overlap_num);
    document.getElementById("course-performance").innerHTML= d.performance;
    document.getElementById("course-bet-rank").innerHTML= d.bet_rank +" /" + course_info.length;
    document.getElementById("course-trans-rank").innerHTML= d.trans_rank +" /" + course_info.length;
    document.getElementById("course-mix-rank").innerHTML= d.mix_rank/2 +" /" + course_info.length;

    /*
        tooltip
            .transition()
            .duration(0)
            .style("opacity", .9)
            .style("display", "block");

        tooltip
            .html(
                "Title: " + d.title+ "</br>" +
                "Area : " + d.area + "</br>" +
                "Subject: " + d.subject + "</br>" +
                "School: " + d.school + "</br></br>" +
                "Community: " + d.community + "</br>" +
                "Community Overlap: " + parseInt(d.overlap_num) + "</br>" +
                "Performance (t+1): " + d.performance + "</br>" +
                "Between Low Rank: " + d.bet_rank +" /" + course_info.length + "</br>" +
                "C.C. Low Rank: " + d.trans_rank +" /" + course_info.length + "</br>" +
                "Mixed Rank: " + d.mix_rank/2 +" /" + course_info.length + "</br>"
            )
            .style("left", (d3.event.pageX + 5) + "px")
            .style("top", (d3.event.pageY - 28) + "px");

    */
}

function mouseOutOnNode(d){
    tooltip.transition()
        .duration(0)
        .style("opacity", 0)
        .style("display", "none");
}

function findNodePositionX(id){
    var temp_x = _.where(nodes, {index: id});
    return temp_x[0].x;
}
function findNodePositionY(id){
    var temp_y = _.where(nodes, {index: id});
    return temp_y[0].y;
}

function findNodeById(id){
    var temp_node = _.where(nodes, {index: id});
    return temp_node;
}

function getNodeColor (node) {
    if (color_mode == "betweenness")
        return betRank_color(node.bet_rank);
    else if (color_mode == "community")
        return node.color;
    else if (color_mode == "transitivity")
        return transRank_color(node.trans_rank);
    else if (color_mode == "mix_rank")
        return mixRank_color(node.mix_rank);
    else if (color_mode == "area")
        return area_color(node.area);
}

function getEdgeColor (edge) {
    if (color_mode == "betweenness")
        return edge.bet_color;
    else if (color_mode == "community")
        return edge.color;
    else if (color_mode == "transitivity")
        return edge.trans_color;
    else if (color_mode == "mix_rank")
        return edge.mix_color;
    else if (color_mode == "area")
        return edge.area_color;
}

function getNodeSize (node) {
    if(size_mode=="overlap_num")
        return 0.001 + (+node.overlap_num*2);
    else if(size_mode=="performance")
        return 0.001 + (+node.performance);
    // else if(size_mode=="betweenness")
    //     return 0.001 + (+d.bet_rank);
    // else if(size_mode=="transitivity")
    //     return 0.001 + (+d.trans_rank);
}
function getNodeOpacity (node){
    if(color_mode=="community"){
        if (+node.overlap_num > 1) return 0;
        else return 1;
    }else{
        return 1;
    }
}
