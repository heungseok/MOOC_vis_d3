var root_fileName = "C19_color_encoded_";

var width = document.getElementById("d3_container").offsetWidth,
    height = document.getElementById("d3_container").offsetHeight;

var svg = d3.select("#d3_container").append("svg").attr("class", "network"),
    g = svg.append("g");

var transform = d3.zoomIdentity,
    zoom = d3.zoom().scaleExtent([0.5, 8]).on("zoom", zoomed);

var x = d3.scaleLinear().range([0, width]);
var y = d3.scaleLinear().range([height, 0]);

var line = d3.line();

// *********** Network Variable: Layout, Community, Nodes, Edges ********** //
var layout = "YifanHu";
// var layout = "ForceAtlas";
// var size_mode = "overlap_num";
var size_mode = "link_overlap_num", color_mode = "link_community", plot_x_mode = "link_overlap_num", plot_y_mode = "performance";
// var size_mode = "performance";
// var color_mode = "community";
// var color_mode = "link_community";

var communities = [];
var link_communities = [];
var overlap_threshold = 10;

var course_info;
var nodes, overlapping_nodes, link_overlapping_nodes, links;

var current_time = 3;
var current_platform = "classCentral";

var color_by_communities = [];
var getCommunityColor = function(d){
    if(color_mode=="community"){
        for(var i=0; i<color_by_communities.length; i++){
            if(color_by_communities[i].comm_id === d)   return color_by_communities[i].color;
        }
    }else if(color_mode=="link_community"){
        return linkCommunity_color(d);
    }

};

// ********** color palette ************ //
var area_color = d3.scaleOrdinal(d3.schemeCategory10);
var betRank_color = d3.scaleSequential(d3.interpolateBuPu);
var transRank_color = d3.scaleSequential(d3.interpolateYlGnBu);
var mixRank_color = d3.scaleSequential(d3.interpolateRdBu);
var linkCommunity_color = d3.scaleOrdinal(d3.schemeCategory20);
var foldness_color = d3.scaleSequential(d3.interpolateRdPu);


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
        else if(size_mode=="link_overlap_num")
            return 0.001 + (Math.sqrt(+d.data.link_overlap_num));
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

// ************************************** side panel plot ************************************** //
var plot_margin = { top: 10, right: 20, bottom: 50, left:50 };
var plot_width = document.getElementById("side_panel").offsetWidth - plot_margin.right - plot_margin.left;
var plot_height = plot_width - plot_margin.top - plot_margin.bottom;

var plot_svg = d3.select("#side_panel").append("svg").attr("class", "plot")
        .attr("width", plot_width + plot_margin.left + plot_margin.right)
        .attr("height", plot_width + plot_margin.top + plot_margin.bottom)
    .append("g")
        .attr("transform", "translate(" + plot_margin.left + ", " + plot_margin.top + ")");

var plot_x = d3.scaleLinear().range([0, plot_width]);
var plot_y = d3.scaleLinear().range([plot_height, 0]);
var plot_x0, plot_y0, plot_xAxis, plot_yAxis;

var plot_brush = d3.brush().on("end", plot_brushended),
    idleTimeout,
    idleDelay = 350;

// ************************************ tooltip ********************************************** //
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

    d3.json("./data/"+ root_fileName + layout + ".json", function(error, graph){
        d3.csv("./data/T3_node_info.csv", function(courses){
            d3.csv("./data/t3_class_central_res_edge.csv", function(linkComm_edges){

                // ************* 1. Course data parsing by global time variable ************ //
                // course_info = _.where(courses, {time: String(current_time), review_platform: current_platform });
                course_info = courses;

                // ******************* color palette domain setting ****************** //
                // each color palette setting by between rank, transitivity rank, mix rank, area
                // 이와 같이 color range를 설정할 경우 isolate까지 포함하게됨.
                var area_list = _.uniq(_.pluck(course_info, "area"));
                var betRank_list = d3.extent(_.pluck(course_info, "bet_rank"));
                betRank_list[0] = +betRank_list[0], betRank_list[1]= +betRank_list[1];

                var transRank_list = d3.extent(_.pluck(course_info, "trans_rank"));
                transRank_list[0] = +transRank_list[0], transRank_list[1]= +transRank_list[1];

                var mixRank_list = _.pluck(course_info, "mix_rank");
                mixRank_list.sort(function(a,b){ return parseInt(a)-parseInt(b);});

                var foldness_list = d3.extent(_.pluck(course_info, "lc_overlapping_num"));
                foldness_list[0] = +foldness_list[0], foldness_list[1] = +foldness_list[1];

                area_color.domain(area_list);
                betRank_color.domain(betRank_list);
                transRank_color.domain(transRank_list);
                mixRank_color.domain([+mixRank_list[0], +mixRank_list[mixRank_list.length-1]]);
                foldness_color.domain(foldness_list);

                // link community parsing and setting the color scheme domain
                var temp_comm = _.pluck(course_info, "lc_community");
                temp_comm.forEach(function(d){ d.split("+").forEach(function(c){ link_communities.push(c); }) });
                link_communities = _.uniq(link_communities);
                linkCommunity_color.domain(link_communities);


                console.log(course_info);
                console.log(graph);

                // ******************* node parsing ****************** //
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

                            // link community result (community, overlapping num)
                            'link_community': res_findWhere.lc_community,
                            'link_overlap_num': +res_findWhere.lc_overlapping_num,
                            'link_single_community': res_findWhere.lc_single_community,

                            // course info
                            'title': res_findWhere.title,
                            'provider': res_findWhere.provider,
                            'area': res_findWhere.area,
                            'subject': res_findWhere.subject,
                            'school': res_findWhere.school,
                            'url': d.attributes.name,

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

                            // link community result (community, overlapping num)
                            'link_community': 'unknown',
                            'link_overlap_num': 0,


                            // course info
                            'title': "unknown",
                            'area' : d.attributes.area,
                            'subject': d.attributes.subject,
                            'school': "unknown",
                            'url': d.attributes.name,

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
                link_communities.sort(function(a, b) { return a.replace("c", "") - b.replace("c", "") });
                console.log(link_communities);


                // ******************* x, y range and domain setting ****************** //
                var x0 = d3.extent(nodes, function(d){ return d.x;});
                var y0 = d3.extent(nodes, function(d){ return d.y;})
                x.domain(x0);
                y.domain(y0);

                // ******************* link parsing ********************************** //
                links = graph.edges.map(function(d){
                    // set edge color by betweenness, transitivity, mix rank, area, link community res

                    // find node by source node for setting each edge color
                    var temp_source_node = findNodeById(d.source)[0];
                    var temp_target_node = findNodeById(d.target)[0];

                    // find edge community by source and target
                    var temp_edge = _.findWhere(linkComm_edges, {node1: temp_source_node.url, node2: temp_target_node.url });
                    if(temp_edge === undefined) {
                        temp_edge = { 'cluster': 'isolate'};
                    } // 나중에 isolate 바꿔줘야할듯, 지금은 임시방편.
                    else temp_edge.cluster = "c"+ temp_edge.cluster;

                    return {
                        'source': d.source,
                        'target': d.target,
                        'size': d.size,
                        'color': d.color,
                        'bet_color': betRank_color(temp_source_node.bet_rank),
                        'trans_color': transRank_color(temp_source_node.trans_rank),
                        'area_color': area_color(temp_source_node.area),
                        'mix_color': mixRank_color(temp_source_node.mix_rank),
                        'fold_color': foldness_color(temp_source_node.link_overlap_num),
                        'linkComm_color': linkCommunity_color(temp_edge.cluster),
                        'link_community': temp_edge.cluster
                    }
                });

                // ******************** cluster overlayed convex hull ************** //
/*
                g.append("g")
                    .attr("class", "communities")
                    .attr("id", "communities")
                    .selectAll("path")
                    .data(communities)
                    // .data(link_communities)
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
*/

                var only_drawed_community = []
                g.append("g")
                    .attr("class", "communities")
                    .attr("id", "communities")
                    .selectAll("path")
                    .data(link_communities)
                    .enter().append("path")
                    .attr("class", "hull")
                    .attr("id", function(d) { return d; })
                    .attr("fill", function(d) { return getCommunityColor(d); })
                    .attr("stroke", function(d) { return getCommunityColor(d); })
                    .attr('d', function(d){
                        // d is community
                        var points = [];
                        nodes.forEach(function (node) {
                            if(Number(node.link_overlap_num) > 1){
                                if(_.contains(node.link_community.split("+"), d))
                                    points.push([x(node.x), y(node.y), node.index])
                            }else{
                                if(d == node.link_single_community && d!="isolate")
                                    points.push([x(node.x), y(node.y), node.index])
                            }
                        });

                        // node 가 100개 이상인 경우에만 hull 생성.
                        if (points.length > 25 && points.length < 51){
                            only_drawed_community.push(d);
                            var convexHull = d3.polygonHull(points);
                            return smoothHull(convexHull);
                        }

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
                        .on("drag", dragged))
                    .on("mouseclick", function(d){ return;}); // do nothing when clicking node

                // ***************  draw overlay pie chart on the node circle **************** //
                overlapping_nodes = getOverlappingNodes_bigGlam();
                link_overlapping_nodes = getOverlappingNodes_LC();
                drawOverlappingPieChart(link_overlapping_nodes, "link_community");

                // ******************* draw chart on side panel ***************** //
                drawSidePanelPlot();


                // ********** Drag zoom initialize ************* //
                svg.call(zoom)
                    .call(zoom.transform, d3.zoomIdentity.translate(width/6, height/10).scale(0.7));



                // ******************* init UI on the top of the screen ***************** //
                // *** set global layout variable and dropdown element active *** //
                $("li."+layout).addClass("active");
                $("ul.nodeAttr>li."+size_mode).addClass("active");
                $("ul.nodeAttr>li."+color_mode).addClass("active");
                $("ul.sidePlot>li."+plot_x_mode+".x_axis").addClass("active");
                $("ul.sidePlot>li."+plot_y_mode+".y_axis").addClass("active");

                // *** Append checkboxes list by each community *** //
                only_drawed_community.forEach(function (commu) {
                    // set inivisible the each convex at first
                    document.getElementById(commu).style.display = "none";

                    // init checked false at first
                    $('ul.network.dropdown-menu').append("<li onmouseover=cb_mouseOver(this); onmouseout=cb_mouseOut(this);><a href='#'><input class='cb_network communities' type='checkbox' onchange=control_network_component(this) " +
                        "value=" + commu + "> " + commu + "</a></li>");
                    // init checked true at first
                    // $('ul.network.dropdown-menu').append("<li><a href='#'><input class='cb_network communities' type='checkbox' onchange=control_network_component(this); checked='checked'" +
                    //     "value=" + commu + "> " + commu + "</a></li>");

                });

                /*communities.forEach(function (commu) {
                    // set inivisible the each convex at first
                    document.getElementById(commu).style.display = "none";

                    // init checked false at first
                    $('ul.network.dropdown-menu').append("<li onmouseover=cb_mouseOver(this); onmouseout=cb_mouseOut(this);><a href='#'><input class='cb_network communities' type='checkbox' onchange=control_network_component(this) " +
                        "value=" + commu + "> " + commu + "</a></li>");
                    // init checked true at first
                    // $('ul.network.dropdown-menu').append("<li><a href='#'><input class='cb_network communities' type='checkbox' onchange=control_network_component(this); checked='checked'" +
                    //     "value=" + commu + "> " + commu + "</a></li>");

                });*/

                // set the loading spinner as none
                document.getElementById("loading").style.display = "none";

            });
        });
    });
}

function drawOverlappingPieChart(overlaps, type){
    var arc = g.select("#nodes").append("g")
        .attr("class", "overlapping_nodes " + type)
        .attr("id", "overlapping_nodes")
        .selectAll(".arc")
        .data(overlaps)
        .enter().append("g")
        .attr("class", "pie_container")
        .attr("transform", function (d) {
            return "translate (" + x(d.x) + "," + y(d.y) + ")";
        })
        .append("g").attr("class", "pies")
        .on("mouseover", function(d) { return mouseMoveOnNode(findNodeById(d.index)[0]) })
        .on("mouseout", function(d) { return mouseOutOnNode(findNodeById(d.index)[0])});

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

}

function getOverlappingNodes_bigGlam(){
    var overlaps = [];
    overlaps = nodes.filter(function(d) {
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
                    "link_overlap_num": +filtered_d.link_overlap_num,
                    'betweenness': +filtered_d.between,
                    'performance': +filtered_d.performance}; })
        }
    });
    overlaps.forEach(function(node, index){

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
                    overlaps[index].overlapping_communities[commu_index].value++;
            }
        })
    });
    return overlaps;
}

function getOverlappingNodes_LC(){
    var overlaps = [];
    overlaps = nodes.filter(function(d) {
        if(+d.link_overlap_num > overlap_threshold) return true;
        return false; // skip

    }).map(function(filtered_d){
        return {
            'index' : filtered_d.index,
            'x' : filtered_d.x,
            'y' : filtered_d.y,
            'overlapping_num': +filtered_d.link_overlap_num,
            'overlapping_communities': filtered_d.link_community.split("+").map(
                function(d){ return { "id": d, "value": 0,
                    "overlap_num": +filtered_d.overlap_num,
                    "link_overlap_num": +filtered_d.link_overlap_num,
                    'betweenness': +filtered_d.between,
                    'performance': +filtered_d.performance}; })
        }
    });
    overlaps.forEach(function(node, index){

        var from = _.pluck(_.where(links, {source: node.index}), "link_community");
        var to = _.pluck(_.where(links, {target: node.index}), "link_community");
        var neighbors = _.union(from, to);
        // link community algorithms의 경우 link마다 community가 mapping되있음.

        neighbors.forEach(function(nei){
            var commu_index = _.indexOf(_.pluck(node.overlapping_communities, "id"), nei);
            if(commu_index !== -1)
                overlaps[index].overlapping_communities[commu_index].value++;
        })
    });
    return overlaps;
}
function setPlotDomain(){

    // x, y scale setting for scatter plot
    if(plot_x_mode == "link_overlap_num")
        plot_x0 = d3.extent(nodes, function(d){ return Math.log(d[plot_x_mode]+1);});
    else
        plot_x0 = d3.extent(nodes, function(d){ return d[plot_x_mode];});

    if(plot_y_mode == "link_overlap_num")
        plot_y0 = d3.extent(nodes, function(d){ return Math.log(d[plot_y_mode]+1);});
    else
        plot_y0 = d3.extent(nodes, function(d){ return d[plot_y_mode];});

    plot_x.domain(plot_x0);
    plot_y.domain(plot_y0);

    plot_xAxis = d3.axisBottom(plot_x);
    plot_yAxis = d3.axisLeft(plot_y);
}

function updateSidePanelPlot(){
    setPlotDomain();
    var t = plot_svg.transition().duration(750);
    plot_svg.select(".axis--x").transition(t).call(plot_xAxis);
    plot_svg.select(".axis--y").transition(t).call(plot_yAxis);

    plot_svg.select("text.x_axis.label").transition(t).text($("ul.sidePlot>li."+plot_x_mode+".x_axis").first().text());
    plot_svg.select("text.y_axis.label").transition(t).text($("ul.sidePlot>li."+plot_y_mode+".y_axis").first().text());

    var plot_circle = plot_svg.selectAll("circle")
        .data(nodes);
    plot_circle.transition(t)
        .attr("cx", function(d) { return plot_x(plot_valueX(d)); })
        .attr("cy", function(d) { return plot_y(plot_valueY(d)); })

}


function drawSidePanelPlot(){
    // ******************* draw chart on side panel ***************** //
    setPlotDomain();

    // add the x,y axis
    plot_svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0, " + plot_height + ")")
        .call(plot_xAxis);
    plot_svg.append("g")
        .attr("class", "axis axis--y")
        .call(plot_yAxis);

    // add brush object
    plot_svg.append("g")
        .attr("class", "brush")
        .call(plot_brush);

    // add labels for each axis
    plot_svg.append("text")
        .attr("class", "x_axis label")
        .attr("transform", "translate(" + (plot_width/2) + "," + (plot_height + plot_margin.top+30) + ")")
        .style("text-anchor", "middle")
        .text($("ul.sidePlot>li."+plot_x_mode).first().text());
        // .text("log(Foldness+1) (overlapping community)");
    plot_svg.append("text")
        .attr("class", "y_axis label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0-plot_margin.left)
        .attr("x", 0 - plot_height/2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text($("ul.sidePlot>li."+plot_y_mode).first().text());
        // .text("log(Performance (t+1))");

    var clip = plot_svg.append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", plot_width)
        .attr("height", plot_height);

    var plot_g = plot_svg.append("g")
        .attr("clip-path","url(#clip)");

    var plot_circle = plot_g.selectAll("dot")
        .data(nodes);

    plot_circle.enter().append("circle")
        .attr("class", "node_circle")
        .attr("r", getNodeSize)
        .attr("cx", function(d) { return plot_x(plot_valueX(d)); })
        .attr("cy", function(d) { return plot_y(plot_valueY(d)); })
        // .attr("cx", function(d) { return plot_x(Math.log(d.link_overlap_num+ 1));})
        // .attr("cy", function(d) { return plot_y(d.performance); })

        .attr("stroke", getNodeColor)
        .attr("stroke-width", 1)
        .attr("fill", "none")

        // .attr("fill", getNodeColor)
        .on("mouseover", mouseMoveOnNode)
        .on("mouseout", mouseOutOnNode);

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

        link_overlapping_nodes.forEach(function(node, index){
            var corresponded_node = _.findWhere(graph.nodes, {id: node.index});
            if (corresponded_node === undefined)
                return;
            else{
                link_overlapping_nodes[index].x = corresponded_node.x;
                link_overlapping_nodes[index].y = corresponded_node.y;
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

        nodes_selector
            .transition(t)
            .attr("cx", function(d) { return x(d.x); })
            .attr("cy", function(d) { return y(d.y); });

        // **************** Pie update ****************** //
        var pie_selector = g.select("#overlapping_nodes")
            .selectAll("g.pie_container")

        pie_selector
            .transition(t)
            .attr("transform", function (d) {
                return "translate (" + x(d.x) + "," + y(d.y) + ")";
            });

    });

}

function changeOthers(){

    // **************** Hull update ****************** //
    // var comm_selector = g.select("#communities")
    //     .selectAll("path");
    //
    // comm_selector
    //     .attr('d', function(d){
    //         var points = [];
    //         nodes.forEach(function (node) {
    //             if(Number(node.overlap_num) > 1){
    //                 if(_.contains(node.community.split("+"), d))
    //                     points.push([x(node.x), y(node.y), node.index])
    //             }else{
    //                 if(d == node.community)
    //                     points.push([x(node.x), y(node.y), node.index])
    //             }
    //         });
    //         var convexHull = d3.polygonHull(points);
    //         return smoothHull(convexHull);
    //
    //     });

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
        $("ul.nodeAttr>li."+size_mode).removeClass("active");
        size_mode = target_size;
    }
    // ****** set global layout variable and dropdown element active ***** //
    $("ul.nodeAttr>li."+size_mode).addClass("active");


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


    // *************** Update scatter plot ************* //
    var scatter_selector = plot_svg.selectAll("circle");
    scatter_selector
        .transition(t)
        // .attr("stroke", getNodeColor)
        .attr("r", getNodeSize);

}

function changeNodeColor(target_color){
    if(target_color === color_mode)
        return;
    else{
        $("ul.nodeAttr>li."+color_mode).removeClass("active");
        color_mode = target_color;
    }
    // ****** set global layout variable and dropdown element active ***** //
    $("ul.nodeAttr>li."+color_mode).addClass("active");

    var t = d3.transition()
        .duration(1000);

    // ************** Update pie if the target color mode contain
    if(color_mode.includes("community")){
        updatePieChart(color_mode);
    }else{
        d3.select("#overlapping_nodes").selectAll("g")
            .transition(t)
            .attr("display", "none");
    }

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

    // *************** Update scatter plot ************* //
    var scatter_selector = plot_svg.selectAll("circle");
    scatter_selector
        .transition(t)
        // .attr("fill", getNodeColor)
        .attr("stroke", getNodeColor);


}

function updatePieChart(mode){
    // **************** Pie update ****************** //
    var pie_selector = d3.select(".overlapping_nodes." + mode);
    if(pie_selector.empty()){
        d3.select("#overlapping_nodes").remove();
        if(mode == "link_community")
            drawOverlappingPieChart(link_overlapping_nodes, "link_community");
        else
            drawOverlappingPieChart(overlapping_nodes, "community");
    }
}



function zoomed(){
    // console.log(d3.event.transform)
    g.select("g.nodes").attr("transform", d3.event.transform);
    g.select("g.edges").attr("transform", d3.event.transform);
    g.select("g.communities").attr("transform", d3.event.transform);
    // g.select("g.overlapping_nodes").attr("transform", d3.event.transform);

}

function dragged(d){

    d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
}
// #################### Network utility ########################## //
function mouseMoveOnNode(d){

    // d3.select(this).attr("stroke-width", 3);

    document.getElementById("course-title").innerHTML= d.title;
    document.getElementById("course-provider").innerHTML= d.provider;
    document.getElementById("course-area").innerHTML= d.area;
    document.getElementById("course-subject").innerHTML= d.subject;
    document.getElementById("course-school").innerHTML= d.school;
    document.getElementById("course-community").innerHTML= d.community.replace(/\+/g, ", ");
    document.getElementById("course-overlapping-community").innerHTML= parseInt(d.overlap_num);
    document.getElementById("course-link-community").innerHTML= d.link_community.replace(/\+/g, ", ");
    document.getElementById("course-link-overlapping-community").innerHTML= parseInt(d.link_overlap_num);
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
    // d3.select(this).attr("stroke-width", 1);
    //
    // tooltip.transition()
    //     .duration(0)
    //     .style("opacity", 0)
    //     .style("display", "none");
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
    else if (color_mode == "link_community")
        return linkCommunity_color(node.link_single_community);
    else if (color_mode == "foldness")
        return foldness_color(node.link_overlap_num);

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
    else if (color_mode == "link_community")
        return edge.linkComm_color;
    else if (color_mode == "foldness")
        return edge.fold_color;
}

function getNodeSize (node) {
    if(size_mode=="overlap_num")
        return 0.001 + (Math.pow(+node.overlap_num,2));
    else if(size_mode=="performance")
        return 0.001 + (+node.performance);
    else if(size_mode=="link_overlap_num")
        return 0.001 + (Math.sqrt(node.link_overlap_num));
    else if(size_mode=="none")
        return 0;
    // else if(size_mode=="betweenness")
    //     return 0.001 + (+d.bet_rank);
    // else if(size_mode=="transitivity")
    //     return 0.001 + (+d.trans_rank);
}
function getNodeOpacity (node){
    if(color_mode=="community"){
        if (+node.overlap_num > 1) return 0;
        else return 1;
    }else if(color_mode=="link_community"){
        if (+node.link_overlap_num > overlap_threshold) return 0;
        else return 1;
    }else{
        return 1;
    }
}


// ********************* plot utilities (brush, etc) ******************** //
function plot_brushended() {
    var s = d3.event.selection;
    if (!s) {
        if (!idleTimeout) return idleTimeout = setTimeout(idled, idleDelay);
        plot_x.domain(plot_x0);
        plot_y.domain(plot_y0);
    } else {
        plot_x.domain([s[0][0], s[1][0]].map(plot_x.invert, plot_x));
        plot_y.domain([s[1][1], s[0][1]].map(plot_y.invert, plot_y));
        d3.select("g.brush").call(plot_brush.move, null);
    }
    plot_zoom_by_brush();
}

function idled() {
    idleTimeout = null;
}

function plot_zoom_by_brush() {
    var t = plot_svg.transition().duration(750);
    plot_svg.select(".axis--x").transition(t).call(plot_xAxis);
    plot_svg.select(".axis--y").transition(t).call(plot_yAxis);
    plot_svg.selectAll("circle").transition(t)
        // .attr("cx", function(d) { return plot_x(d.link_overlap_num); })
        .attr("cx", function(d) { return plot_x(plot_valueX(d)); })
        .attr("cy", function(d) { return plot_y(plot_valueY(d)); });
        // .attr("cx", function(d) { return plot_x(d.trans); })
        // .attr("cy", function(d) { return plot_y(d.between); });
}

function plot_valueX(d){
    // x, y scale setting for scatter plot
    if(plot_x_mode == "link_overlap_num")
        return Math.log(d[plot_x_mode]+1);
    else
        return d[plot_x_mode];

}
function plot_valueY(d) {

    if(plot_y_mode == "link_overlap_num")
        return Math.log(d[plot_y_mode]+1);
    else
        return d[plot_y_mode];

}


/*
 // ************ draw each edge using line *************** //
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
