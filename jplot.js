/*******************************************************************************
 * This file is part of jPlot
 * Copyright (C) 2016 Bert Vandenbroucke (bert.vandenbroucke@gmail.com)
 *
 * jPlot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * jPlot is distributed in the hope that it will be useful,
 * but WITOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with jPlot. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/

/**
 * @brief Custom Math.log10() implementation
 *
 * Because Android browsers do not support log10() (but do support log()).
 *
 * @param x Value
 * @return Base-10 logarithm of value
 */
function log10(x){
    return Math.log(x)/Math.LN10;
}

/**
 * @brief Generate a random string of characters that can be used as unique id
 *
 * Since some browsers fail on id's that start with a number, we make sure the
 * first character is always non-numeric.
 *
 * @return A random string
 */
function randStr(){
    var str = Math.random().toString(36).slice(2);
    while(!isNaN(str[0])){
        str = Math.random().toString(36).slice(2);
    }
    return str;
}

/**
 * @brief Get the DOM element corresponding to the currently executed script
 *
 * Since not all browsers support the convenient document.currentScript
 * attribute, we also implement an alternative method that makes use of the fact
 * that the current script will always be the last script in the
 * document.scripts list.
 *
 * @return The DOM element correspnding to the currently executed script
 */
function get_current_script(){
    var script =  document.currentScript;
    if(script){
        return script;
    }
    // webkit version
    var scripts = document.scripts;
    script = scripts[scripts.length - 1];
    return script;
}

var Figure = function(w, h){
    var parent = get_current_script().parentElement;
    if(typeof w == "undefined"){
        w = 800;
    }
    if(typeof h == "undefined"){
        h = 0.75*w;
    }
    this.w = w;
    this.h = h;
    this.id = randStr();
    var fig = document.createElement("div");
    fig.id = this.id;
    fig.style.width = w + "px";
    fig.style.height = h + "px";
    parent.appendChild(fig);
}

Figure.prototype.create_plot = function(){
    return new Plot("#" + this.id, this.w, this.h);
}

/* AxisLocator class */
var AxisLocator = function(data, key, islog){
    if(typeof islog === "undefined"){
        islog = false;
    }
    this.islog = islog;
    this.minval = d3.min(data, function(d){
        if(d.selected){
            return d[key];
        } else {
            return Number.MAX_VALUE;
        }
    });
    this.maxval = d3.max(data, function(d){
        if(d.selected){
            return d[key];
        } else {
            return -Number.MAX_VALUE;
        }
    });
    if(this.islog){
        this.minval = log10(this.minval);
        this.maxval = log10(this.maxval);
    }
    this.minval = Math.floor(this.minval);
    this.maxval = Math.ceil(this.maxval);
    this.size = this.maxval - this.minval;
}

AxisLocator.prototype.get_coord = function(val){
    if(this.islog){
        val = log10(val);
    }
    return (val - this.minval)/this.size;
}

AxisLocator.prototype.get_major_ticks = function(){
    var ticks = [];
    for(var i = this.minval; i <= this.maxval; ++i){
        ticks.push((i - this.minval)/this.size);
    }
    return ticks;
}

AxisLocator.prototype.get_major_labels = function(){
    var labels = [];
    for(var i = this.minval; i <= this.maxval; ++i){
        if(this.islog){
            labels.push("\\(10^{" + i + "}\\)");
        } else {
            labels.push("\\(" + i + "\\)");
        }
    }
    return labels;
}

AxisLocator.prototype.get_minor_ticks = function(){
    var ticks = [];
    if(this.islog){
        for(var i = this.minval; i <= this.maxval; ++i){
            for(var j = 2; j < 10; ++j){
                ticks.push((i+log10(j) - this.minval)/this.size);
            }
        }
    } else {
        for(var i = this.minval; i <= this.maxval; ++i){
            for(var j = 1; j < 10; ++j){
                ticks.push((i+0.1*j - this.minval)/this.size);
            }
        }
    }
    return ticks;
}

/* Filter class */
var StringFilter = function(key, value){
    this.key = key;
    this.value = new RegExp(value);
}

StringFilter.prototype.filter = function(data){
    var self = this;
    data.forEach(function(d){
        if(!self.value.exec(d[self.key])){
            d.selected = false;
        }
    });
}

var FloatFilter = function(key, value){
    this.key = key;
    this.value = value;
}

FloatFilter.prototype.filter = function(data){
    var self = this;
    data.forEach(function(d){
        if(d[self.key] == self.value){
            d.selected = false;
        }
    });
}

/* Plot class */
var Plot = function(id, width, height){
    this.ready = true;
    this.plotready = true;
    
    this.limits_valid = false;
    this.queue = [];

    if(typeof width === "undefined"){
        width = 700;
    }
    if(typeof height === "undefined"){
        height = 500;
    }
    this.height = height;
    this.width = width;
    this.plotwidth = 0.9*this.width;
    this.plotheight = 0.9*this.height;

    var container = d3.select(id);
    // make sure children of the container are positioned w.r.t. the container
    // by changing the position: static default value to relative
    container.attr("style", "position: relative;\
                             width: " + this.width + "px;\
                             height: " + this.height + "px");
    this.svg = container.append("svg")
    .attr("width", this.plotwidth)
    .attr("height", this.plotheight)
    .attr("style", "position: absolute;\
                    left: " + (this.width-this.plotwidth) + "px;\
                    top: 0");
    this.xlabel = container.append("p")
    .text("\\(x\\)-label")
    .attr("style", "position: absolute; top: 100px");
    this.ylabel = container.append("p")
    .text("\\(y\\)-label")
    .attr("style", "position: absolute; top: 100px");

    this.xticks = container.append("div")
    .attr("style", "position: absolute;\
                    top: " + this.plotheight + "px;\
                    left: " + (this.width-this.plotwidth) + "px;\
                    height: " + 0.5*(this.height-this.plotheight) + "px;\
                    width: " + this.plotwidth + "px;\
                    font-size: 75%");

    this.yticks = container.append("div")
    .attr("style", "position: absolute;\
                    top: 0;\
                    left: " + 0.5*(this.width-this.plotwidth) + "px;\
                    width: " + 0.5*(this.width-this.plotwidth) + "px;\
                    height: " + this.plotheight + "px;\
                    font-size: 75%");

    // draw the borders
    var bordergroup = this.svg.append("g");
    this.add_line(bordergroup, 1, 1, 1, this.plotheight);
    this.add_line(bordergroup, 1, this.plotheight-1, this.plotwidth, 
                  this.plotheight-1);
    this.add_line(bordergroup, this.plotwidth-1, 1, this.plotwidth-1,
                  this.plotheight-1);
    this.add_line(bordergroup, 1, 1, this.plotwidth, 1);

    this.plotgroup = this.svg.append("g");

    this.move_labels();

    // reparse labels
    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
}

Plot.prototype.move_labels = function(){
    // move the x-label
    var xwidth = this.xlabel[0][0].clientWidth;
    var xheight = this.xlabel[0][0].clientHeight;
    var xtop = 0.5*(this.height + this.plotheight);
    var xleft = this.width - 0.5*(this.plotwidth+xwidth);
    this.xlabel.attr("style", "position: absolute;\
                               top: " + xtop + "px;\
                               left: " + xleft + "px;\
                               margin: 0px");

    // move the y-label
    var ywidth = this.ylabel[0][0].clientWidth;
    var yheight = this.ylabel[0][0].clientHeight;
    // the rotation is done around the midpoint of the box, so we have to
    // correct for this
    var ytop = 0.5*(this.plotheight - yheight);
    var yleft = 0.5*(this.width - this.plotwidth - yheight - ywidth);
    this.ylabel.attr("style", "position: absolute;\
                               top: " + ytop + "px;\
                               left: " + yleft + "px;\
                               margin: 0px;\
                               -ms-transform: rotate(-90deg);\
                               -webkit-transform: rotate(-90deg);\
                               transform: rotate(-90deg)");
    
    if(!this.limits_valid){
        // move the x-ticks (if any)
        var xlabels = this.xticks.selectAll("p")[0];
        // a for each somehow also returns the div container...
        for(var ilabel = 0; ilabel < xlabels.length; ++ilabel){
            var lwidth = xlabels[ilabel].clientWidth;
            var lleft = parseFloat(xlabels[ilabel].style.left);
            xlabels[ilabel].style.left = lleft - 0.5*lwidth + "px";
        }
        
        // move the y-ticks (if any)
        var ylabels = this.yticks.selectAll("p")[0];
        for(var ilabel = 0; ilabel < ylabels.length; ++ilabel){
            var lheight = ylabels[ilabel].clientHeight;
            var ltop = parseFloat(ylabels[ilabel].style.top);
            ylabels[ilabel].style.top = ltop - 0.5*lheight + "px";
        }
        
        this.limits_valid = true;
    }
}

Plot.prototype.add_line = function(group, x1, y1, x2, y2){
    group.append("line")
    .attr("x1", x1)
    .attr("y1", y1)
    .attr("x2", x2)
    .attr("y2", y2)
    .attr("style", "stroke: rgb(0,0,0); stroke-width: 1");
}

Plot.prototype.add_point = function(group, x, y, sym){
    if(typeof sym === "undefined"){
        sym = "kox";
    }
    
    var symreg = /[os\^]/;
    var symbol = symreg.exec(sym)[0];
    
    var colreg = /[rbgakyldqpcemtn]/;
    var color = colreg.exec(sym);
    
    var fillreg = /[xz]/;
    var fill = fillreg.exec(sym)[0];
    
    var colors = {"r": "red", "b": "blue", "g": "green", "a": "gray",
                  "k": "black", "y": "yellow", "l": "darkgreen",
                  "d": "darkblue", "q":"darkred", "p": "purple", "c": "cyan",
                  "e": "orange", "m": "magenta", "t": "seagreen",
                  "n": "orangered"};
                  
    var facecolor = "transparent";
    if(fill == "x"){
        facecolor = colors[color];
    }

    switch(symbol){
        case "o":
            group.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 5)
            .attr("stroke", colors[color])
            .attr("fill", facecolor);
            break;
        case "s":
            group.append("rect")
            .attr("x", x-5)
            .attr("y", y-5)
            .attr("width", 10)
            .attr("height", 10)
            .attr("stroke", colors[color])
            .attr("fill", facecolor);
            break;
        case "^":
            group.append("polygon")
            .attr("points", x + "," + (y-5) + " " + (x+5) + "," + (y+5) + " "
                            + (x-5) + "," + (y+5))
            .attr("stroke", colors[color])
            .attr("fill", facecolor);
    }
}

Plot.prototype.load_data = function(name){
    var fname = "load_data_" + name
    this.queue.push(fname);
    var self = this;
    this.loaded = false;
    d3.tsv(name, function(data){
        data.forEach(function(d){
            for(var key in d){
                // convert numerical values to floats
                var floatval = +d[key];
                if(!isNaN(floatval)){
                    d[key] = floatval;
                }
            }
            d.selected = true;
        });
        self.data = data;
        self.loaded = true;
        // remove the blocking element from the queue
        self.queue.shift();
    });
}

/**
 * @brief Magical function to deal with asynchronous events
 *
 * The problem is that some d3 events (like loading data), are done in the
 * background. If we write serial scripts (what we would like to do), this
 * means that the data we need might not be available yet.
 * The only way to solve this problem is by checking if the data is available
 * and respawning the call to the routine after some delay with setTimeout()
 * if it is not available.
 * This might still screw up the order in which functions are executed, since
 * routines with the same data dependency are not necessarily respawned in the
 * correct order (or some may be executed the first time, while others are only
 * executed after respawning).
 * This means we would need to do an awful lot of bookkeeping to make sure all
 * possible combinations of functions are always executed in the same order as
 * we call them, if this is even possible.
 *
 * In this routine, we solve the problem in another way: by making sure all
 * routines are effectively executed in the order in which they are called.
 * When a function is first called, we convert the function call to a unique
 * key that is added to a stack. Only if the function corresponds to the first
 * key on the stack can it be executed, otherwise it is respawned. All
 * bookkeeping is done inside this routine, all unsafe routines should just add
 * the following three lines of code to the beginning of the routine:
 *  if(!this.is_ready(arguments)){
 *    return;
 *  }
 * All routines should also have a label, which can be done by putting some
 * label in between the function and the ().
 * The stack can be blocked (for example in load_data) by adding a key to the
 * beginning of the stack. The stack is released again when this key is
 * removed.
 */
Plot.prototype.is_ready = function(arguments){
    var fname = arguments.callee.name;
    for(var i = 0; i < arguments.length; i++){
        fname += "_" + arguments[i];
    }
    var argarray = Array.prototype.slice.call(arguments);
    if(this.queue.indexOf(fname) < 0){
        // we add a random flag to the end of the arguments to distinguish
        // between different calls to exactly the same routine
        // this is possible since we can append to the arguments, so that on
        // the first call to the routine the flag will always be absent, but
        // on consecutive calls it will be there (and will be the same)
        var randflag = Math.random();
        argarray[arguments.length] = randflag;
        fname += "_" + randflag;
        this.queue.push(fname);
    }
    // uncomment to show the queue in the console
//    console.log(this.queue);
    if(this.queue[0] != fname){
        setTimeout(
            arguments.callee.bind.apply(
                arguments.callee, [this].concat(argarray)
            ), 10);
        return false;
    } else {
        this.queue.shift();
        return true;
    }
}

Plot.prototype.filter = function filter(key, value){
    if(!this.is_ready(arguments)){
        return;
    }
    
    var filter;
    if(!isNaN(+value)){
        filter = new FloatFilter(key, value);
    } else {
        filter = new StringFilter(key, value);
    }
    filter.filter(this.data);
    this.ready = true;
}

Plot.prototype.set_limits = function set_limits(xvar, yvar, xlog, ylog){
    if(!this.is_ready(arguments)){
        return;
    }
    
    if(!this.xlocator){
        // add ticks
        this.xlocator = new AxisLocator(this.data, xvar, xlog);
        this.ylocator = new AxisLocator(this.data, yvar, ylog);
        var xticks = this.xlocator.get_minor_ticks();
        for(var itick in xticks){
            tick = xticks[itick];
            this.add_line(this.plotgroup, tick*this.plotwidth, 0, tick*this.plotwidth, 5);
            this.add_line(this.plotgroup, tick*this.plotwidth, this.plotheight,
                          tick*this.plotwidth, this.plotheight-5);
        }
        xticks = this.xlocator.get_major_ticks();
        for(var itick in xticks){
            tick = xticks[itick];
            this.add_line(this.plotgroup, tick*this.plotwidth, 0, tick*this.plotwidth,
                          10);
            this.add_line(this.plotgroup, tick*this.plotwidth, this.plotheight,
                          tick*this.plotwidth, this.plotheight-10);
        }
        var yticks = this.ylocator.get_minor_ticks();
        for(var itick in yticks){
            tick = yticks[itick];
            this.add_line(this.plotgroup, 0, (1.0-tick)*this.plotheight,
                          5, (1.0-tick)*this.plotheight);
            this.add_line(this.plotgroup, this.plotwidth, (1.0-tick)*this.plotheight,
                          this.plotwidth-5, (1.0-tick)*this.plotheight);
        }
        yticks = this.ylocator.get_major_ticks();
        for(var itick in yticks){
            tick = yticks[itick];
            this.add_line(this.plotgroup, 0, (1.0-tick)*this.plotheight,
                          10, (1.0-tick)*this.plotheight);
            this.add_line(this.plotgroup, this.plotwidth, (1.0-tick)*this.plotheight,
                          this.plotwidth-10, (1.0-tick)*this.plotheight);
        }
        
        // add ticklabels
        var xlabels = this.xlocator.get_major_labels();
        for(var ilabel in xlabels){
            this.xticks.append("p")
            .attr("style", "position: absolute;\
                            margin: 0px;\
                            left: " + xticks[ilabel]*this.plotwidth + "px")
            .text(xlabels[ilabel]);
        }
        var ylabels = this.ylocator.get_major_labels();
        for(var ilabel in ylabels){
            this.yticks.append("p")
            .attr("style", "position: absolute;\
                            margin: 0px;\
                            top: " + (1.0-yticks[ilabel])*this.plotheight + "px;\
                            right: 0px")
            .text(ylabels[ilabel]);
        }
        
        this.limits_valid = false;
    }
}

Plot.prototype.commonplot = function commonplot(xvar, yvar, xlog, ylog, sym){
    if(!this.is_ready(arguments)){
        return;
    }
    
    var self = this;
    if(typeof sym === "undefined"){
        sym = "ko";
    }
    
    if(!this.xlocator){
        // add ticks
        this.xlocator = new AxisLocator(this.data, xvar, xlog);
        this.ylocator = new AxisLocator(this.data, yvar, ylog);
        var xticks = this.xlocator.get_minor_ticks();
        for(var itick in xticks){
            tick = xticks[itick];
            this.add_line(this.plotgroup, tick*this.plotwidth, 0, tick*this.plotwidth, 5);
            this.add_line(this.plotgroup, tick*this.plotwidth, this.plotheight,
                          tick*this.plotwidth, this.plotheight-5);
        }
        xticks = this.xlocator.get_major_ticks();
        for(var itick in xticks){
            tick = xticks[itick];
            this.add_line(this.plotgroup, tick*this.plotwidth, 0, tick*this.plotwidth,
                          10);
            this.add_line(this.plotgroup, tick*this.plotwidth, this.plotheight,
                          tick*this.plotwidth, this.plotheight-10);
        }
        var yticks = this.ylocator.get_minor_ticks();
        for(var itick in yticks){
            tick = yticks[itick];
            this.add_line(this.plotgroup, 0, (1.0-tick)*this.plotheight,
                          5, (1.0-tick)*this.plotheight);
            this.add_line(this.plotgroup, this.plotwidth, (1.0-tick)*this.plotheight,
                          this.plotwidth-5, (1.0-tick)*this.plotheight);
        }
        yticks = this.ylocator.get_major_ticks();
        for(var itick in yticks){
            tick = yticks[itick];
            this.add_line(this.plotgroup, 0, (1.0-tick)*this.plotheight,
                          10, (1.0-tick)*this.plotheight);
            this.add_line(this.plotgroup, this.plotwidth, (1.0-tick)*this.plotheight,
                          this.plotwidth-10, (1.0-tick)*this.plotheight);
        }
        
        // add ticklabels
        var xlabels = this.xlocator.get_major_labels();
        for(var ilabel in xlabels){
            this.xticks.append("p")
            .attr("style", "position: absolute;\
                            margin: 0px;\
                            left: " + xticks[ilabel]*this.plotwidth + "px")
            .text(xlabels[ilabel]);
        }
        var ylabels = this.ylocator.get_major_labels();
        for(var ilabel in ylabels){
            this.yticks.append("p")
            .attr("style", "position: absolute;\
                            margin: 0px;\
                            top: " + (1.0-yticks[ilabel])*this.plotheight + "px;\
                            right: 0px")
            .text(ylabels[ilabel]);
        }
        this.limits_valid = false;
    }
    
    this.xlabel.text(xvar);
    this.ylabel.text(yvar);
    
    // reparse labels
    MathJax.Hub.Register.StartupHook("End Typeset", this.move_labels.bind(this));
    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
    
    // add the data
    this.data.forEach(function(d){
        if(d.selected){
            var x = self.xlocator.get_coord(d[xvar]);
            var y = self.ylocator.get_coord(d[yvar]);
            self.add_point(self.plotgroup, x*self.plotwidth,
                           (1.0-y)*self.plotheight, sym);
        }
    });
    
    this.plotready = true;
}

Plot.prototype.set_xlabel = function set_xlabel(label){
    if(!this.is_ready(arguments)){
        return;
    }

    this.xlabel.text(label);
    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
}

Plot.prototype.set_ylabel = function set_ylabel(label){
    if(!this.is_ready(arguments)){
        return;
    }
    
    this.ylabel.text(label);
    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
}

Plot.prototype.loglog = function(xvar, yvar, sym){
    this.commonplot(xvar, yvar, true, true, sym);
}

Plot.prototype.semilogx = function(xvar, yvar, sym){
    this.commonplot(xvar, yvar, true, false, sym);
}

Plot.prototype.semilogy = function(xvar, yvar, sym){
    this.commonplot(xvar, yvar, false, true, sym);
}

Plot.prototype.plot = function(xvar, yvar, sym){
    this.commonplot(xvar, yvar, false, false, sym);
}

Plot.prototype.clear = function clear(){
    if(!this.is_ready(arguments)){
        return;
    }
    
    this.plotgroup.remove();
    this.plotgroup = this.svg.append("g");
    this.xlabel.text("\\(x\\)-label");
    this.ylabel.text("\\(y\\)-label");
    
    this.xticks.selectAll("p").remove();
    this.yticks.selectAll("p").remove();
    
    this.xlocator = null;
    this.ylocator = null;
    
    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
}

Plot.prototype.clear_filter = function clear_filter(){
    if(!this.is_ready(arguments)){
        return;
    }
    
    this.data.forEach(function(d){
        d.selected = true;
    });
}
