function Game(id, params) {
	var self = this;

	//设置画布大小
	var settings = {
		width: 480,
		height: 640
	};

	Object.assign(self, setting, params);
	var $canvas = document.getElementById(id);
	$canvas.width = self.width;
	$canvas.height = self.height;
	var selfcontext = $canvas.getContext('2d');
	var selfstages = [];
	var selfevents = {};
	var selfindex = 0,
		selfhander;

	//创建一个对象
	var Item = function (params) {
		this.selfparams = params || {};
		this.selfid = 0; //id
		this.selfstage = null; //所属场景
		this.selfsettings = {
			x: 0,
			y: 0, //横纵坐标
			width: 20,
			height: 20, //宽高
			type: 0, //对象类型,0表示普通对象(不与地图绑定),1表示玩家控制对象,2表示程序控制对象
			color: '#F00', //颜色
			status: 1, //状态,0表示未激活/结束,1表示正常,2表示暂停,3表示临时,4表示异常
			orientation: 0, //当前定位方向,0表示右,1表示下,2表示左,3表示上
			speed: 0, //速度
			//地图
			location: null, //定位地图,Map对象
			coord: null, //如果对象与地图绑定,需设置地图坐标;若不绑定,则设置位置坐标
			path: [], //NPC自动行走的路径
			vector: null, //目标坐标
			//布局
			frames: 1, //速度等级,内部计算器times多少帧变化一次
			times: 0, //刷新画布计数(用于循环动画状态判断)
			timeout: 0, //倒计时(用于过程动画状态判断)
			control: {}, //控制缓存,到达定位点时处理
			update: function () {}, //更新参数信息
			draw: function () {} //绘制
		};
		Object.assign(this, this.selfsettings, this.selfparams);
	};

	Item.prototype.bind = function (eventType, callback) {
		if (!selfevents[eventType]) {
			selfevents[eventType] = {};
			$canvas.addEventListener(eventType, function (e) {
				var position = self.getPosition(e);
				selfstages[selfindex].items.forEach(function (item) {
					if (Math.abs(position.x - item.x) < item.width / 2 && Math.abs(position.y - item.y) < item.height / 2) {
						var key = 's' + selfindex + 'i' + item.selfid;
						if (selfevents[eventType][key]) {
							selfevents[eventType][key](e);
						}
					}
				});
				e.preventDefault();
			});
		}
		selfevents[eventType]['s' + this.selfstage.index + 'i' + this.selfid] = callback.bind(this); //绑定作用域
	};

	//地图对象构造器
	var Map = function (params) {
		this.selfparams = params || {};
		this.selfid = 0; //标志符
		this.selfstage = null; //与所属布景绑定
		this.selfsettings = {
			x: 0,
			y: 0, //地图起点坐标
			size: 20, //地图单元的宽度
			data: [], //地图数据
			x_length: 0, //二维数组x轴长度
			y_length: 0, //二维数组y轴长度
			frames: 1, //速度等级,内部计算器times多少帧变化一次
			times: 0, //刷新画布计数(用于循环动画状态判断)
			cache: false, //是否静态（如静态则设置缓存）
			update: function () {}, //更新地图数据
			draw: function () {}, //绘制地图
		};
		Object.assign(this, this.selfsettings, this.selfparams);
	};
	//当某一个点(x,y)存在且被定义则返回这个点的值
	Map.prototype.get = function (x, y) {
		if (this.data[y] && typeof this.data[y][x] != 'undefined') {
			return this.data[y][x];
		}
		return -1;
	}
	//设置地图上的某点(前提存在于地图内)
	Map.prototype.set = function (x, y, value) {
		if (this.data[y]) {
			this.data[y][x] = value;
		}
	}
	//地图坐标转化为画布位置
	Map.prototype.coordToPosition = function (cx, cy) {
		return {
			x: this.x + cx * this.size + this.size / 2,
			y: this.y + cy * this.size + this.size / 2
		};
	};
	//画布位置转化为地图坐标
	Map.prototype.positionToCoord = function (x, y) {
		var fx = Math.abs(x - this.x) % this.size - this.size / 2;
		var fy = Math.abs(y - this.y) % this.size - this.size / 2;
		return {
			x: Math.floor((x - this.x) / this.size),
			y: Math.floor((y - this.y) / this.size),
			offset: Math.sqrt(fx * fx + fy * fy)
		};
	};
	//寻址
	Map.prototype.finder = function (params) {
		var defaults = {
			map: null,
			start: {},
			end: {},
			type: 'path'
		};
		var options = Object.assign({}, defaults, params);
		//当起点或终点设置在墙上
		if (options.map[options.start.y][options.start.x] || options.map[options.end.y][options.end.x]) {
			return [];
		}
		var finded = false; //代表有无找到可走路径
		var result = []; //可走列表
		var y_length = options.map.length;
		var x_length = options.map.length;
		//步骤的映射
		var steps = [];
		for (var y = y_length; y--;) {
			steps[y] = new Array(x_length).fill(0);
		}
		//获取地图上的值
		var selfGetValue = function (x, y) {
			if (options.map[y] && typeof options.map[y][x] != 'undefined') {
				return options.map[y][x];
			}
			return -1;
		};

		var selfCanGo = function (to) { //判定是否可走,可走放入列表
			var value = selfGetValue(to.x, to.y);
			if (value < 1) {
				if (value == -1) {
					to.x = (to.x + x_length) % x_length;
					to.y = (to.y + y_length) % y_length;
					to.change = 1;
				}
				if (!steps[to.y][to.x]) {
					result.push(to);
				}
			}
		};
		//找寻路线
		var selfRender = function (list) {
			var new_list = [];
			var canGo = function (from, to) {
				var value = selfGetValue(to.x, to.y);
				//判断to点是否可走
				if (value < 1) {
					if (value == -1) {
						to.x = (to.x + x_length) % x_length;
						to.y = (to.y + y_length) % y_length;
						to.change = 1;
					}
					if (to.x == options.end.x && to.y == options.end.y) {
						steps[to.y][to.x] = from;
						finded = true;
					} else if (!steps[to.y][to.x]) {
						steps[to.y][to.x] = from;
						new_list.push(to);
					}
				}
			};
			list.forEach(function (current) {
				canGo(current, {
					y: current.y + 1,
					x: current.x
				});
				canGo(current, {
					y: current.y,
					x: current.x + 1
				});
				canGo(current, {
					y: current.y - 1,
					x: current.x
				});
				canGo(current, {
					y: current.y,
					x: current.x - 1
				});
			});
			if (!finded && new_list.length) {
				selfRender(new_list);
			}
		};
		selfRender([options.start]);
		if (finded) {
			var current = options.end;
			if (options.type == 'path') {
				while (current.x != options.start.x || current.y != options.start.y) {
					result.unshift(current);
					current = steps[current.y][current.x];
				}
			} else if (options.type == 'canGo') {
				selfCanGo({
					x: current.x + 1,
					y: current.y
				});
				selfCanGo({
					x: current.x,
					y: current.y + 1
				});
				selfCanGo({
					x: current.x - 1,
					y: current.y
				});
				selfCanGo({
					x: current.x,
					y: current.y - 1
				});
			}
		}
		return result;
	};
	//布局对象构造器
	var Stage = function(params){
		this.selfparams = params||{};
		this.selfsettings = {
			index:0,
			status:0,
			map:[],
			audio:[],
			images:[],
			items:[],
			timeout:0,
			update: function(){}
		};
		Object.assign(this, this.selfsettings,this.selfparams);
	};
	//添加对象
	Stage.prototype.createItem = function(options){
		var item = new Item(options);
		//动态属性
		if(item.location){
			var position = item.location.coordToPosition(item.coord.x,item.coord.y);
			item.x = position.x;
			item.y = position.y;
		}
		//关系绑定
		item.selfstage = this;
		item.selfid = this.items.length;
		this.items.push(item);
		return item;
	};
	//重置对象位置
	Stage.prototype.resetItem = function(){
		rhis,status = 1;
		this.items.forEach(function(item,index){
			Object.assign(item,item.selfsettings,item.selfparams);
			if(item.location){
				var postion  = item.location.coordToPosition(item.coord.x,item.coord.y);
				item.x = position.x;
				item.y = position.y;
			}
		});
	};
	//获取对象列表
	Stage.prototype.getItemsByType = function(type){
		return this.items.filter(function(item){
			if(item.type == type){
				return item;
			}
		});
	};
	//添加地图
	Stage.prototype.createMap = function(options){
		var map = new Map(options);
		//动态属性
		map.data = JSON.parse(JSON.stringify(map.selfparams.data));
		map.y_length = map.data.length;
		map.x_length = map.data[0].length;
		map.imageData = null;
		//关系绑定
		map.selfstage = this; //添加第二关及以后的地图
		map.selfid = this.maps.length;
		this.maps.push(map);
		return map;
	};
	//重置地图
	Stage.prototype.resetMaps = function(){
        this.status = 1;
        this.maps.forEach(function(map){
            Object.assign(map,map.selfsettings,map.selfparams);
            map.data = JSON.parse(JSON.stringify(map.selfparams.data));
            map.y_length = map.data.length;
            map.x_length = map.data[0].length;
            map.imageData = null;
        });
	};
	//重置对象位置和地图
    Stage.prototype.reset = function(){
        Object.assign(this,this.selfsettings,this.selfparams);
        this.resetItems();
        this.resetMaps();
	};
	//绑定事件
    Stage.prototype.bind = function(eventType,callback){
        if(!selfevents[eventType]){
            selfevents[eventType] = {};
            window.addEventListener(eventType,function(e){
                var key = 's' + selfindex;
                if(selfevents[eventType][key]){
                    selfevents[eventType][key](e);
                }
                e.preventDefault();
            });
		}
		//绑定事件作用域
        selfevents[eventType]['s'+this.index] = callback.bind(this);	
	};
	this.start = function(){
		var f = 0; //计算帧率
		var fn = function(){
			var stage = selfstages[selfindex];
			//清除画布
			selfcontext.clearRect(0,0,self.width,self.height);
			selfcontext.fillStyle = '#000000';
			selfcontext.fillRect(0,0,self.width,self.height);
			f++;
			if(stage.timeout){
				stage.timeout--;
			}
			if(stage.update()!=false){
				stage.maps.forEach(function(map){
					if(!(f%map.frames)){
						map.times = f/map.frames;
					}
					if(map.cache){
						if(!map.imageData){
							selfcontext.save();
							map.draw(selfcontext);
							map.imageData = selfcontext.getImageData(0,0,self.width,self.height);
							selfcontext.restore();
						}
						else{
							selfcontext.putImageDate(map.imageData,0,0);
						}
					}
					else{
						map.update();
						map.draw(selfcontext);
					}
				});
				stage.items.forEach(function(item){
					if(!(f%item.frames)){
                        item.times = f/item.frames;		   //计数器
                    }
                    if(stage.status==1&&item.status!=2){  	//对象及布景状态都不处于暂停状态
                        if(item.location){
                            item.coord = item.location.position2coord(item.x,item.y);
                        }
                        if(item.timeout){
                            item.timeout--;
                        }
                        item.update();
                    }
                    item.draw(_context);
				});
			}
			selfhander = requestAnimationFrame(fn);
		}
		selfhander = requestAnimationFrame(fn);
	};
	//动画结束
	this.stop = function(){
		selfhander && cancelAnimationFrame(selfhander);
	};
	//事件坐标
	this.getPosition = function(e){
		var box = $canvas.getBoundingClientRect();
		return {
			x: e.clientX - box.left*(self.width/box.width),
			y: e.clientY - box.top*(self.height/box.height)
		};
	}
	//创建布景
	this.createStage = function(options){
		var stage = new Stage(options);
		stage.index = selfstages.length;
		selfstages.push(stage);
		return stage;
	};
	//设置布景
	this.setStage = function(index){
		selfstages[selfindex].status = 0;
		selfindex = index;
		selfstages[selfindex].status = 1;
		selfstages[selfindex].reset();
		return selfstages[selfindex];
	};
	//下一个布景
	this.nextStage = function(){
		return selfstages;
	}

	//初始化引擎
	this.initialization = function(){
		selfindex = 0;
		this.start();
	};







}