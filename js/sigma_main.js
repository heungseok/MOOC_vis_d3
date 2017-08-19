

// function requestData(){
//     if(array_index == url_arr.length)
//         return;
//
//     $.getJSON(url_arr[array_index], function(data, textStatus, jqXHR){
//         network_arr.push(data);
//         network_arr.sort(compare);
//         array_index++;
//         requestData();
//     });
// }


function requestData(index){

    $.getJSON(url_arr[index], function(data, textStatus, jqXHR){
        network_arr.push(data);
        network_arr.sort(compare);
    });
}

function compare(a,b){
    if(parseInt(a.time) < parseInt(b.time))
        return -1;
    if(parseInt(a.time) > parseInt(b.time))
        return 1;
    return 0;
}


// sigma instance initialization.
function sigma_init(network){

    // node init
    network.nodes.forEach(function(node, index){
        g.nodes.push({
            id: node.course_id,
            node_id: node.attributes.index,
            label: node.attributes.title,
            x: node.x,
            y: node.y,
            size: node.size,
            // color: node.color,
            color: node.area_color,
            area: node.attributes.area,
            subject: node.attributes.subject,
            provider: node.attributes.provider,
            school: node.attributes.school,


            // this is for animating node
            target_color: "#FFFFFF",
            target_size: 10,
            target_x: -100,
            target_y: -100

        });
    });

    // edge init
    network.edges.forEach(function(edge, index){
        // console.log(edge);
        g.edges.push({
            id: network.time + "-" + edge.id,
            source: edge.source,
            target: edge.target,
            size: edge.size,
            // color: edge.color,
            color: edge.area_color,
            type: "curvedArrow",
            flag: false

        });
    });

    console.log(g);

    // sigma init
    s = new sigma({
        graph: g,
        // container: 'graph-container',
        // when rendering the network with canvas,, the speed is quite slow.
        renderer: {
            container: document.getElementById('graph-container'),
            type: 'canvas'
        },

        settings:{

            minArrowSize: 5,
            defaultLabelSize: 30,
            animationTime: 3000,
            minNodeSize: 1,
            maxNodeSize: 17,
            labelThreshold: 17,
            sideMargin: 70
        }

    });


    console.log(s.graph.nodes());
    network_arr.sort(compare); // sort by time
    console.log(network_arr);


}


// ####################### Init utility ####################

// attach nodeUpdate function to sigma graph method
sigma.classes.graph.addMethod('nodeUpdate', function(target_nodes) {
    console.log("Update node");
    // nodesArray는 node info를 담고있는 sigma class 내장 변수인듯,

    // underscore.js의 pluck을 이용해서 target_nodes 의 각 object에서 course_id만 뽑아서 array로 만듬.
    var target_nodes_ids = _.pluck(target_nodes, 'course_id');
    var node_to_remove = [];

    // 먼저 시간간격안에 겹치지 않는 노드들 삭제
    // 먼저 삭제할 노드들을 어레이에 따로 저장.
    for(var i=0; i<this.nodesArray.length; i++){
        if(!_.contains(target_nodes_ids, this.nodesArray[i].id)){
            // console.log("push the id to array- " + this.nodesArray[i].id);
            node_to_remove.push(this.nodesArray[i].id);
        }

    }
    // 다음으로 삭제해야할 node들을 삭제.
    for(var i=0; i<node_to_remove.length; i++){
        s.graph.dropNode(node_to_remove[i]);
    }

    // 다음으로 node update, 기존에 존재하는 노드일 경우 attribute만 업데이트.
    // 존재하지 않은 노드일 경우 새로 추가.
    var source_nodes_ids = _.pluck(this.nodesArray, 'id');
    for(var i=0; i<target_nodes.length; i++){

        var target = target_nodes[i];
        if(_.contains(source_nodes_ids, target.course_id)){
            var temp_index = _.indexOf(source_nodes_ids, target.course_id);
            // this.nodesArray[temp_index].target_color = target.color;
            this.nodesArray[temp_index].target_color = target.area_color;
            this.nodesArray[temp_index].target_x = target.x;
            this.nodesArray[temp_index].target_y = target.y;
            this.nodesArray[temp_index].target_size = target.size;

        }else{
            s.graph.addNode({
                id: target.course_id,
                node_id: target.attributes.index,
                label: target.attributes.title,
                x: 0,
                y: 0,
                size: 0,
                // color: target.color,
                color: target.area_color,
                area: target.attributes.area,
                subject: target.attributes.subject,
                provider: target.attributes.provider,
                school: target.attributes.school,

                // this is for animating node
                // target_color: target.color,
                target_color: target.area_color,
                target_size: target.size,
                target_x: target.x,
                target_y: target.y

            });

        }

    }
    console.log("End of update node");

});




// attach updateEdge function to sigma graph method
sigma.classes.graph.addMethod('updateEdge', function(target_edges, time){
    console.log("Update edge");
    
    // 1. 더이상 존재하지 않는 엣지 삭제
    // 2.1. 새로운 쌍의 source, target이 나올 경우 추가.
    // 2.2. 이미 있는 edge의 경우 attribute만 변경
    
    // 현재 저장되어 있는 edge의 source, target만 extract
    var existing_edges = _.map(
        this.edgesArray, function (edge) {
            return { source: edge.source, target: edge.target}
        }
    );
    // 새로운 edge의 source, target만 extract
    var new_edges = _.map(
        target_edges, function (edge) {
            return { source: edge.source, target: edge.target}
        }
    );

    // 1. 더이상 존재하지 않는 엣지 삭제
    // 먼저 target edge가 현재 존재하는지 check하고, 없을 경우 삭제. 
    var remove_edge_ids = [];
    for(var i=0; i< existing_edges.length; i++){

        // 없을 경우 undefined return,
        var result = _.findWhere(new_edges, existing_edges[i]);
        if(result === undefined){
            // console.log("remove edge: " + existing_edges[i].source + "-" + existing_edges[i].target);
            remove_edge_ids.push(this.edgesArray[i].id);
        }
    }
    
    // edge remove
    for(var i=0; i<remove_edge_ids.length; i++){
        s.graph.dropEdge(remove_edge_ids[i]);
    }

    // 2.1. 새로운 쌍의 source, target이 나올 경우 추가.
    // 2.2. 이미 있는 edge의 경우 attribute만 변경
    for(var i=0; i<new_edges.length; i++){
        // return 값이 undefined 일 경우 새로운 edge이므로 추가.
        var result = _.findWhere(existing_edges, new_edges[i]);
        if (result == undefined){
            s.graph.addEdge({
                    id: time + "-" + target_edges[i].id,
                    source: target_edges[i].source,
                    target: target_edges[i].target,
                    size: target_edges[i].size,
                    // color: target_edges[i].color,
                    color: target_edges[i].area_color,
                    type: "curvedArrow",
                    flag: false
                });

        }else{
            var edge_index;
            _.find(existing_edges, function (item, index) {
                if (item == result){
                    edge_index = index;
                }
            });
            if(this.edgesArray[edge_index] != undefined){
                this.edgesArray[edge_index].size = target_edges[i].size;
                // this.edgesArray[edge_index].size = target_edges[i].color;
                this.edgesArray[edge_index].size = target_edges[i].area_color;
            }

        }
    }
    console.log("End of update edge");

});

// ####################### END of utility ####################


// call the binded function in sigam.graph
function changeNetwork(from, to){

    console.log(from + "-" + to );
    var target_network = network_arr[to-1];
    s.graph.nodeUpdate(target_network.nodes);
    s.graph.updateEdge(target_network.edges, to);
    animation();
}


// animation func
function animation(){
    sigma.plugins.animate(
        s,
        {
            x: 'target_x',
            y: 'target_y',
            size: 'target_size',
            color: 'target_color'
        },
        {
            easing: 'cubicInOut',
            duration: 2000,
            onComplete: function() {
                console.log("success!");
                // console.log(s.graph.nodes());

                // do stuff here after animation is complete
            }
        }
    );
}

function cleanNetwork() {
    s.graph.clear();
    g.nodes.length = 0;
    g.edges.length = 0;
    g.nodes = [];
    g.edges = [];
    
    
}

function clean_networkCanvas() {
    $('#graph-container>canvas').remove()
}

function switchNetwork() {
    
    url_arr.length =0;
    network_arr.length = 0;
    array_index = 0;
    url_arr = [
        "../data/t1_" + platform + "_network.json",
        "../data/t2_" + platform + "_network.json",
        "../data/t3_" + platform + "_network.json",
        "../data/t4_" + platform + "_network.json"
    ];
    return init();

}