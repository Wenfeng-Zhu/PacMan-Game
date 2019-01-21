function Game(id, params) {
	var _ = this;
	//设置画布大小
	var settings = {
		width: 480,
		height: 640
	};
	Object.assign(_, settings, params);
	var $canvas = document.getElementById(id);
	$canvas.width = _.width;
	$canvas.height = _.height;
	var _context = $canvas.getContext('2d'); //画布上下文环境
	var _stages = []; //布景对象队列
	var _events = {}; //事件集合
	var _index = 0, //当前布景索引
		_hander; //帧动画控制
	//活动对象构造
	var Item = function (params) {
		this._params = params || {};
		this._id = 0; //标志符
		this._stage = null; //与所属布景绑定
		this._settings = {
			x: 0, //位置坐标:横坐标
			y: 0, //位置坐标:纵坐标
			width: 20, //宽
			height: 20, //高
			type: 0, //对象类型,0表示普通对象(不与地图绑定),1表示玩家控制对象,2表示程序控制对象
			color: '#F00', //标识颜色
			status: 1, //对象状态,0表示未激活/结束,1表示正常,2表示暂停,3表示临时,4表示异常
			orientation: 0, //当前定位方向,0表示右,1表示下,2表示左,3表示上
			speed: 0, //移动速度
			//地图相关
			location: null, //定位地图,Map对象
			coord: null, //如果对象与地图绑定,需设置地图坐标;若不绑定,则设置位置坐标
			path: [], //NPC自动行走的路径
			vector: null, //目标坐标
			//布局相关
			frames: 1, //速度等级,内部计算器times多少帧变化一次
			times: 0, //刷新画布计数(用于循环动画状态判断)
			timeout: 0, //倒计时(用于过程动画状态判断)
			control: {}, //控制缓存,到达定位点时处理
			update: function () {}, //更新参数信息
			draw: function () {} //绘制
		};
		Object.assign(this, this._settings, this._params);
	};
	Item.prototype.bind = function (eventType, callback) {
		//判断events是否存在
		if (!_events[eventType]) {
			_events[eventType] = {};
			$canvas.addEventListener(eventType, function (e) {
				var position = _.getPosition(e);
				_stages[_index].items.forEach(function (item) {
					if (Math.abs(position.x - item.x) < item.width / 2 && Math.abs(position.y - item.y) < item.height / 2) {
						var key = 's' + _index + 'i' + item._id;
						if (_events[eventType][key]) {
							_events[eventType][key](e);
						}
					}
				});
				e.preventDefault();
			});
		}
		_events[eventType]['s' + this._stage.index + 'i' + this._id] = callback.bind(this); //绑定作用域
	};
	//地图构造器
	var Map = function (params) {
		this._params = params || {};
		this._id = 0; //标志符
		this._stage = null; //与所属布景绑定
		this._settings = {
			x: 10,
			y: 10, //地图起点坐标
			size: 16, //地图单元的宽度
			data: [], //地图数据
			x_length: 0, //二维数组x轴长度
			y_length: 0, //二维数组y轴长度
			frames: 1, //速度等级,内部计算器times多少帧变化一次
			times: 0, //刷新画布计数(用于循环动画状态判断)
			cache: false, //是否静态（如静态则设置缓存）
			update: function () {}, //更新地图数据
			draw: function () {}, //绘制地图
		};
		Object.assign(this, this._settings, this._params);
	};
	//获取地图上某点的值
	Map.prototype.get = function (x, y) {
		if (this.data[y] && typeof this.data[y][x] != 'undefined') {
			return this.data[y][x];
		}
		return -1;
	};
	//设置地图上某点的值
	Map.prototype.set = function (x, y, value) {
		if (this.data[y]) {
			this.data[y][x] = value;
		}
	};
	//Map数组坐标转画布坐标
	Map.prototype.coordToPosition = function (cx, cy) {
		return {
			x: this.x + cx * this.size + this.size / 2,
			y: this.y + cy * this.size + this.size / 2
		};
	};
	//画布坐标转Map数组坐标
	Map.prototype.positionToCoord = function (x, y) {
		var fx = Math.abs(x - this.x) % this.size - this.size / 2;
		var fy = Math.abs(y - this.y) % this.size - this.size / 2;
		return {
			x: Math.floor((x - this.x) / this.size),
			y: Math.floor((y - this.y) / this.size),
			offset: Math.sqrt(fx * fx + fy * fy)
		};
	};

	//寻址算法
	{
		Map.prototype.searchRoad = function (start, end) {
			var openList = [], //开启列表
				closeList = [], //关闭列表
				result = [], //结果数组
				result_index; //结果数组在开启列表中的序号

			openList.push({
				x: start.x,
				y: start.y,
				G: 0
			}); //把当前点加入到开启列表中，并且G是0

			do {
				var currentPoint = openList.pop();
				closeList.push(currentPoint);
				var surroundPoint = SurroundPoint(currentPoint);
				for (var i in surroundPoint) {
					var item = surroundPoint[i]; //获得周围的八个点
					if (


						this.get(item.x, item.y) != 1 && //判断是否是障碍物
						!existList(item, closeList) && //判断是否在关闭列表中
						this.get(item.x, currentPoint.y) != 1 &&
						this.get(currentPoint.x, item.y) != 1) //判断之间是否有障碍物，如果有障碍物是过不去的=避免对角线移动
					{
						//g 到父节点的位置
						//如果是上下左右位置的则g等于10，斜对角的就是14
						var g = currentPoint.G + 10;
						if (!existList(item, openList)) { //如果不在开启列表中
							//计算H，通过水平和垂直距离进行确定
							item['H'] = Math.abs(end.x - item.x) * 10 + Math.abs(end.y - item.y) * 10;
							item['G'] = g;
							item['F'] = item.H + item.G;
							item['parent'] = currentPoint;
							openList.push(item);
						} else { //存在在开启列表中，比较目前的g值和之前的g的大小
							var index = existList(item, openList);
							//如果当前点的g更小
							if (g < openList[index].G) {
								openList[index].parent = currentPoint;
								openList[index].G = g;
								openList[index].F = g + openList[index].H;
							}

						}
					}
				}
				//如果开启列表空了，没有通路，结果为空
				if (openList.length == 0) {
					break;
				}
				openList.sort(sortF); //这一步是为了循环回去的时候，找出 F 值最小的, 将它从 "开启列表" 中移掉
			} while (!(result_index = existList({
					x: end.x,
					y: end.y
				}, openList)));

			//判断结果列表是否为空
			if (!result_index) {
				result = [];
			} else {
				var currentObj = openList[result_index];
				do {
					//把路劲节点添加到result当中
					result.unshift({
						x: currentObj.x,
						y: currentObj.y
					});
					currentObj = currentObj.parent;
				} while (currentObj.x != start.x || currentObj.y != start.y);

			}
			return result;

		}
		//用F值对数组排序
		function sortF(a, b) {
			return b.F - a.F;
		}
		//获取周围八个点的值
		function SurroundPoint(curPoint) {
			var x = curPoint.x,
				y = curPoint.y;
			return [{
					x: x - 1,
					y: y - 1
				},
				{
					x: x,
					y: y - 1
				},
				{
					x: x + 1,
					y: y - 1
				},
				{
					x: x + 1,
					y: y
				},
				{
					x: x + 1,
					y: y + 1
				},
				{
					x: x,
					y: y + 1
				},
				{
					x: x - 1,
					y: y + 1
				},
				{
					x: x - 1,
					y: y
				}
			]
		}
		//判断点是否存在在列表中，是的话返回的是序列号
		function existList(point, list) {

			for (var i = 0; i < list.length; i++) {
				if (point.x == list[i].x && point.y == list[i].y) {
					return i;
				}
			}

			return false;
		}
	}
	//布景对象构造器
	var Stage = function (params) {
		this._params = params || {};
		this._settings = {
			index: 0, //布景索引
			status: 0, //布景状态,0表示未激活/结束,1表示正常,2表示暂停,3表示临时状态
			maps: [], //地图队列
			audio: [], //音频资源
			images: [], //图片资源
			items: [], //对象队列
			timeout: 0, //倒计时(用于过程动画状态判断)
			update: function () {} //嗅探,处理布局下不同对象的相对关系
		};
		Object.assign(this, this._settings, this._params);
	};
	//添加对象
	Stage.prototype.createItem = function (options) {
		var item = new Item(options);
		//动态属性
		if (item.location) {
			var position = item.location.coordToPosition(item.coord.x, item.coord.y);
			item.x = position.x;
			item.y = position.y;
		}
		//关系绑定
		item._stage = this;
		item._id = this.items.length;
		this.items.push(item);
		return item;
	};
	//重置物体位置
	Stage.prototype.resetItems = function () {
		this.status = 1;
		this.items.forEach(function (item, index) {
			Object.assign(item, item._settings, item._params);
			if (item.location) {
				var position = item.location.coordToPosition(item.coord.x, item.coord.y);
				item.x = position.x;
				item.y = position.y;
			}
		});
	};
	//获取对象列表
	Stage.prototype.getItemsByType = function (type) {
		return this.items.filter(function (item) {
			if (item.type == type) {
				return item;
			}
		});
	};
	//添加地图
	Stage.prototype.createMap = function (options) {
		var map = new Map(options);
		//添加至地图队列
		map._stage = this;
		map._id = this.maps.length;
		this.maps.push(map);
		return map;
	};
	//重置地图
	Stage.prototype.resetMaps = function () {
		this.status = 1;
		this.maps.forEach(function (map) {
			Object.assign(map, map._settings, map._params);
			map.data = JSON.parse(JSON.stringify(map._params.data));
			map.y_length = map.data.length;
			map.x_length = map.data[0].length;
			map.imageData = null;
		});
	};
	//重置
	Stage.prototype.reset = function () {
		Object.assign(this, this._settings, this._params);
		this.resetItems();
		this.resetMaps();
	};
	//绑定事件
	Stage.prototype.bind = function (eventType, callback) {
		if (!_events[eventType]) {
			_events[eventType] = {};
			window.addEventListener(eventType, function (e) {
				var key = 's' + _index;
				if (_events[eventType][key]) {
					_events[eventType][key](e);
				}
				e.preventDefault();
			});
		}
		_events[eventType]['s' + this.index] = callback.bind(this); //绑定事件作用域
	};
	//动画开始
	this.start = function () {
		var f = 0; //帧数计算
		var fn = function () {
			var stage = _stages[_index];
			_context.clearRect(0, 0, _.width, _.height); //清除画布
			_context.fillStyle = '#000000';
			_context.fillRect(0, 0, _.width, _.height);
			f++;
			if (stage.timeout) {
				stage.timeout--;
			}
			if (stage.update() != false) { //update返回false,则不绘制
				stage.maps.forEach(function (map) {
					if (!(f % map.frames)) {
						map.times = f / map.frames; //计数器,由于stage的刷新频率等于item的刷新频率
					}
					if (map.cache) {
						if (!map.imageData) {
							_context.save();
							map.draw(_context);
							map.imageData = _context.getImageData(0, 0, _.width, _.height);
							_context.restore();
						} else {
							_context.putImageData(map.imageData, 0, 0);
						}
					} else {
						map.update();
						map.draw(_context);
					}
				});
				stage.items.forEach(function (item) {
					if (!(f % item.frames)) {
						item.times = f / item.frames; //计数器
					}
					if (stage.status == 1 && item.status != 2) { //对象及布景状态都不处于暂停状态
						if (item.location) {
							item.coord = item.location.positionToCoord(item.x, item.y);
						}
						if (item.timeout) {
							item.timeout--;
						}
						item.update();
					}
					item.draw(_context);
				});
			}
			_hander = requestAnimationFrame(fn);
		};
		_hander = requestAnimationFrame(fn);
	};
	//动画结束
	this.stop = function () {
		_hander && cancelAnimationFrame(_hander);
	};
	//事件坐标
	this.getPosition = function (e) {
		var box = $canvas.getBoundingClientRect();
		return {
			x: e.clientX - box.left * (_.width / box.width),
			y: e.clientY - box.top * (_.height / box.height)
		};
	}
	//布景相关
	this.createStage = function (options) {
		var stage = new Stage(options);
		stage.index = _stages.length;
		_stages.push(stage);
		return stage;
	};
	this.setStage = function (index) {
		_stages[_index].status = 0;
		_index = index;
		_stages[_index].status = 1;
		_stages[_index].reset(); //重置
		return _stages[_index];
	};
	this.nextStage = function () {
		if (_index < _stages.length - 1) {
			return this.setStage(++_index);
		} else {
			throw new Error('unfound new stage.');
		}
	};
	this.getStages = function () {
		return _stages;
	};
	//初始化
	this.init = function () {
		_index = 0;
		this.start();
	};
}
//游戏主程序
(function () {
	var _COIGIG = [{
		'map': [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			[1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1],
			[1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1],
			[0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			[1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			[1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1],
			[1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1],
			[1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1],
			[1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1],
			[1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1],
			[1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]



		],
		'wall_color': '#4169E1',
		'powerpellets': { //能量豆
			'1,3': 1,
			'24,3': 1,
			'1,23': 1,
			'24,23': 1
		}
	}];
	_COLOR = ['#00FFFF', '#FFA500', '#FF0000', '#FFC0CB'], //NPC颜色
		_LR = [1, 0, -1, 0],
		_UD = [0, 1, 0, -1],
		_LIFE = 4, //玩家生命值
		_SCORE = 0; //玩家得分

	var game = new Game('canvas');
	//Start Page

	(function () {
		var stage = game.createStage();

		//Name of the game
		stage.createItem({
			x: game.width / 2,
			y: game.height * .4,

			draw: function (context) {
				context.font = 'bold 42px Arial';
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				context.fillStyle = '#FFF';
				context.fillText('Game Pacman', this.x, this.y);
			}
		});

		var audioStart = document.getElementById('opening_song');
		audioStart.play();



		//事件绑定:切换至下一个场景，并暂停音效
		stage.bind('keydown', function (e) {
			switch (e.keyCode) {
				case 13: //Enter
				case 32: //Space
					{
						audioStart.pause();
						game.nextStage();
					}
					break;
			}
		});
	})();

	//GamePart
	(function () {
		_COIGIG.forEach(function (config, index) {
			var stage, map, dots, items, player, times;
			stage = game.createStage({

				update: function () {
					var stage = this;
					if (stage.status == 1) { //场景正常运行
						items.forEach(function (item) {
							if (map && !map.get(item.coord.x, item.coord.y) && !map.get(player.coord.x, player.coord.y)) {
								var dx = item.x - player.x;
								var dy = item.y - player.y;
								if (dx * dx + dy * dy < 750 && item.status != 4) { //物体检测
									if (item.status == 3) {
										item.status = 4;
										var audioEatGhost = document.getElementById('eatghost'); //当鬼魂被吃掉时播放音效
										audioEatGhost.loop = false;
										audioEatGhost.play();
										_SCORE += 10;
									} else {
										stage.status = 3;
										stage.timeout = 30;
									}
								}
							}
						});
					} else if (stage.status == 3) { //场景临时状态
						if (!stage.timeout) {
							_LIFE--;
							if (_LIFE) {
								stage.resetItems();
							} else {
								var stages = game.getStages();
								game.setStage(stages.length - 1);
								return false;
							}
						}
					}
				}
			});

			//绘制地图
			map = stage.createMap({
				x: 30,
				y: 10,
				data: config['map'],
				draw: function (context) {
					context.lineWidth = 3;
					for (var j = 0; j < this.y_length; j++) {
						for (var i = 0; i < this.x_length; i++) {
							var value = this.get(i, j);
							//地图采用0，1绘制，只需要绘制出1所代表的墙体的外围部分
							if (value) {
								var code = [0, 0, 0, 0];
								if (this.get(i + 1, j) && !(this.get(i + 1, j - 1) && this.get(i + 1, j + 1) && this.get(i, j - 1) && this.get(i, j + 1))) {
									code[0] = 1;
								}
								if (this.get(i, j + 1) && !(this.get(i - 1, j + 1) && this.get(i + 1, j + 1) && this.get(i - 1, j) && this.get(i + 1, j))) {
									code[1] = 1;
								}
								if (this.get(i - 1, j) && !(this.get(i - 1, j - 1) && this.get(i - 1, j + 1) && this.get(i, j - 1) && this.get(i, j + 1))) {
									code[2] = 1;
								}
								if (this.get(i, j - 1) && !(this.get(i - 1, j - 1) && this.get(i + 1, j - 1) && this.get(i - 1, j) && this.get(i + 1, j))) {
									code[3] = 1;
								}
								//判断code中是否有1，是否出现过上述情况
								if (code.indexOf(1) > -1) {
									context.strokeStyle = value == 2 ? '#FFFFFF' : config['wall_color'];
									var pos = this.coordToPosition(i, j);
									switch (code.join('')) {
										case '1100':
											context.beginPath();
											context.arc(pos.x + this.size / 2, pos.y + this.size / 2, this.size / 2, Math.PI, 1.5 * Math.PI, false);
											context.stroke();
											context.closePath();
											break;
										case '0110':
											context.beginPath();
											context.arc(pos.x - this.size / 2, pos.y + this.size / 2, this.size / 2, 1.5 * Math.PI, 2 * Math.PI, false);
											context.stroke();
											context.closePath();
											break;
										case '0011':
											context.beginPath();
											context.arc(pos.x - this.size / 2, pos.y - this.size / 2, this.size / 2, 0, .5 * Math.PI, false);
											context.stroke();
											context.closePath();
											break;
										case '1001':
											context.beginPath();
											context.arc(pos.x + this.size / 2, pos.y - this.size / 2, this.size / 2, .5 * Math.PI, 1 * Math.PI, false);
											context.stroke();
											context.closePath();
											break;
										default:
											var dist = this.size / 2;
											code.forEach(function (v, index) {
												if (v) {
													context.beginPath();
													context.moveTo(pos.x, pos.y);
													context.lineTo(pos.x - _LR[index] * dist, pos.y - _UD[index] * dist);
													context.stroke();
													context.closePath();
												}
											});
									}
								}
							}
						}
					}
				}
			});
			//DotsMap
			dots = stage.createMap({
				x: 30,
				y: 10,
				data: config['map'],
				frames: 8,
				//绘制可走路径上的普通豆和能量豆
				draw: function (context) {
					for (var j = 0; j < this.y_length; j++) {
						for (var i = 0; i < this.x_length; i++) {
							if (!this.get(i, j)) {
								var pos = this.coordToPosition(i, j);
								context.fillStyle = "#FFF8DC";
								if (config['powerpellets'][i + ',' + j]) {
									context.beginPath();
									context.arc(pos.x, pos.y, 5 + this.times % 2, 0, 2 * Math.PI, true);
									context.fill();
									context.closePath();
								} else {
									context.fillRect(pos.x - 2, pos.y - 2, 4, 4);
								}
							}
						}
					}
				}
			});
			//Score
			stage.createItem({
				x: 60,
				y: 550,
				draw: function (context) {
					context.font = 'bold 26px Arial';
					context.textAlign = 'left';
					context.textBaseline = 'bottom';
					context.fillStyle = '#FFF';
					context.fillText('SCORE', this.x, this.y);
					context.font = '28px Arial';
					context.textAlign = 'left';
					context.textBaseline = 'top';
					context.fillStyle = '#FFF';
					context.fillText(_SCORE, this.x + 40, this.y);

				}
			});
			//pause
			stage.createItem({
				x: 180,
				y: 250,
				frames: 25,
				draw: function (context) {
					if (stage.status == 2 && this.times % 2) {
						context.font = '40px Arial';
						context.textAlign = 'left';
						context.textBaseline = 'center';
						context.fillStyle = '#98FB98';
						context.fillText('PAUSE', this.x, this.y);
					}
				}
			});
			//HP
			stage.createItem({
				x: 320,
				y: 540,
				width: 30,
				height: 30,
				draw: function (context) {
					var max = Math.min(_LIFE - 1, 5);
					for (var i = 0; i < max; i++) {
						var x = this.x + 40 * i,
							y = this.y;
						context.fillStyle = '#FFFF00';
						context.beginPath();
						context.arc(x, y, this.width / 2, .15 * Math.PI, -.15 * Math.PI, false);
						context.lineTo(x, y);
						context.closePath();
						context.fill();
					}
				}
			});
			//Ghost
			for (var i = 0; i < 4; i++) {
				stage.createItem({
					width: 16,
					height: 16,
					orientation: 3,
					color: _COLOR[i],
					location: map,
					coord: {
						x: 11 + i,
						y: 14
					},
					vector: {
						x: 11 + i,
						y: 14
					},
					type: 2,
					frames: 10,
					speed: 1,
					timeout: Math.floor(Math.random() * 400),

					update: function () {
						var startPoint = {
							x: 12,
							y: 15
						};


						if (this.status == 3 && !this.timeout) {
							this.status = 1;
						}
						if (!this.coord.offset) { //到达坐标中心时计算
							if (this.status == 1) {
								if (!this.timeout) { //定时器
									this.map = JSON.parse(JSON.stringify(map.data).replace(/2/g, 0));


									this.path = map.searchRoad(
										this.coord,
										player.coord
									);
									if (this.path.length) {
										this.vector = this.path[0];
									}
								}
							} else if (this.status == 3) {
								this.map = JSON.parse(JSON.stringify(map.data).replace(/2/g, 0));
								this.path = map.searchRoad(
									this.coord,
									player.coord
								);
								if (this.path.length) {
									this.vector = this.path[0];
								}
							} else if (this.status == 4) {
								this.map = JSON.parse(JSON.stringify(map.data).replace(/2/g, 0));
								this.path = map.searchRoad(
									this.coord,
									this._params.coord
								);
								if (this.path.length != 1) {
									this.vector = this.path[0];
								} else {
									this.status = 1;


								}
							}
							//是否转变方向
							if (this.vector.change) {
								this.coord.x = this.vector.x;
								this.coord.y = this.vector.y;
								var pos = map.coordToPosition(this.coord.x, this.coord.y);
								this.x = pos.x;
								this.y = pos.y;
							}
							//方向判定
							if (this.vector.x > this.coord.x) {
								this.orientation = 0;
							} else if (this.vector.x < this.coord.x) {
								this.orientation = 2;
							} else if (this.vector.y > this.coord.y) {
								this.orientation = 1;
							} else if (this.vector.y < this.coord.y) {
								this.orientation = 3;
							}
						}
						this.x += this.speed * _LR[this.orientation];
						this.y += this.speed * _UD[this.orientation];
					},



					draw: function (context) {

						var isSick = false;
						if (this.status == 3) {
							isSick = this.timeout > 80 || this.times % 2 ? true : false;
						}

						if (this.status != 4) {
							context.fillStyle = (isSick ? '#BABABA' : this.color);

							context.beginPath();
							context.arc(this.x, this.y, this.width * .5, 0, Math.PI, true);
							switch (this.times % 2) {
								case 0:
									context.lineTo(this.x - this.width * .5, this.y + this.height * .4);
									context.quadraticCurveTo(this.x - this.width * .4, this.y + this.height * .5, this.x - this.width * .2, this.y + this.height * .3);
									context.quadraticCurveTo(this.x, this.y + this.height * .5, this.x + this.width * .2, this.y + this.height * .3);
									context.quadraticCurveTo(this.x + this.width * .4, this.y + this.height * .5, this.x + this.width * .5, this.y + this.height * .4);
									break;
								case 1:
									context.lineTo(this.x - this.width * .5, this.y + this.height * .3);
									context.quadraticCurveTo(this.x - this.width * .25, this.y + this.height * .5, this.x, this.y + this.height * .3);
									context.quadraticCurveTo(this.x + this.width * .25, this.y + this.height * .5, this.x + this.width * .5, this.y + this.height * .3);
									break;
							}
							context.fill();
							context.closePath();
						}

						//眼睛
						context.beginPath();
						context.fillStyle = '#FFFFFF';
						context.arc(this.x + this.width * .15, this.y - this.height * .21, this.width * .12, 0, 2 * Math.PI, false);
						context.arc(this.x - this.width * .15, this.y - this.height * .21, this.width * .12, 0, 2 * Math.PI, false);
						context.fill();
						context.closePath();
						context.beginPath();
						context.fillStyle = '#000000';
						context.arc(this.x + this.width * .15, this.y - this.height * .21, this.width * .05, 0, 2 * Math.PI, false);
						context.arc(this.x - this.width * .15, this.y - this.height * .21, this.width * .05, 0, 2 * Math.PI, false);
						context.fill();
						context.closePath();



					}
				});

			}


			items = stage.getItemsByType(2);

			//主角
			player = stage.createItem({
				audioStatus: 0,

				width: 20,
				height: 20,
				type: 1,
				location: map,
				coord: {
					x: 13.5,
					y: 23
				},
				orientation: 2,
				speed: 2,
				frames: 10,
				update: function () {
					var coord = this.coord;
					if (!coord.offset) {
						if (this.control.orientation != 'undefined') {
							if (!map.get(coord.x + _LR[this.control.orientation], coord.y + _UD[this.control.orientation])) {
								this.orientation = this.control.orientation;
							}
						}
						this.control = {};
						var value = map.get(coord.x + _LR[this.orientation], coord.y + _UD[this.orientation]);
						//前进方向上是否可走，speed根据是否可走保持或归零
						if (value == 0) {
							this.x += this.speed * _LR[this.orientation];
							this.y += this.speed * _UD[this.orientation];
						} else if (value < 0) { //地图中的左右穿越部分
							this.x -= map.size * (map.x_length - 1) * _LR[this.orientation];
							this.y -= map.size * (map.y_length - 1) * _UD[this.orientation];
						}
					} else {
						if (!dots.get(this.coord.x, this.coord.y)) { //吃豆

							var audioEatpill = document.getElementById('eatpill');
							audioEatpill.loop = false; //eatingpill音效仅播放一次

							_SCORE++;
							dots.set(this.coord.x, this.coord.y, 1);
							if (config['powerpellets'][this.coord.x + ',' + this.coord.y]) { //吃到能量豆
								audioEatpill.play(); //吃到能量豆时播放eatpill音效
								items.forEach(function (item) {
									if (item.status == 1 || item.status == 3) { //如果NPC为正常状态，则置为临时状态
										item.timeout = 450;
										item.status = 3;

									}

								});
							}
						}
						this.x += this.speed * _LR[this.orientation];
						this.y += this.speed * _UD[this.orientation];
					}
				},
				draw: function (context) {
					context.fillStyle = '#FFFF00';
					context.beginPath();
					if (stage.status != 3) { //玩家正常状态
						if (this.times % 2) {
							context.arc(this.x, this.y, this.width / 2, (.5 * this.orientation + .20) * Math.PI, (.5 * this.orientation - .20) * Math.PI, false);
						} else {
							context.arc(this.x, this.y, this.width / 2, (.5 * this.orientation + .01) * Math.PI, (.5 * this.orientation - .01) * Math.PI, false);
						}
					} else { //玩家被吃
						var audioDie = document.getElementById('die');
						audioDie.loop = false;
						audioDie.play(); //玩家被吃时播放die音效，且只播放一次
						if (stage.timeout) {
							context.arc(this.x, this.y, this.width / 2, (.5 * this.orientation + 1 - .02 * stage.timeout) * Math.PI, (.5 * this.orientation - 1 + .02 * stage.timeout) * Math.PI, false);
						}
					}
					context.lineTo(this.x, this.y);
					context.closePath();
					context.fill();
				}
			});
			//事件绑定
			stage.bind('keydown', function (e) {
				switch (e.keyCode) {
					case 13: //回车
					case 32: //空格
						this.status = this.status == 2 ? 1 : 2;
						break;
					case 39: //右
						player.control = {
							orientation: 0
						};
						break;
					case 40: //下
						player.control = {
							orientation: 1
						};
						break;
					case 37: //左
						player.control = {
							orientation: 2
						};
						break;
					case 38: //上
						player.control = {
							orientation: 3
						};
						break;
				}
			});
		});
	})();
	//结束画面
	(function () {
		var stage = game.createStage();
		//游戏结束
		stage.createItem({
			x: game.width / 2,
			y: game.height * .35,
			draw: function (context) {
				context.fillStyle = '#FFF';
				context.font = 'bold 48px Arial';
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				context.fillText(_LIFE ? 'YOU WIN!' : 'GAME OVER', this.x, this.y);
			}
		});
		//记分
		stage.createItem({
			x: game.width / 2,
			y: game.height * .5,
			draw: function (context) {
				context.fillStyle = '#FFF';
				context.font = '20px Arial';
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				context.fillText('FINAL SCORE: ' + (_SCORE + 50 * Math.max(_LIFE - 1, 0)), this.x, this.y);
			}
		});
		//事件绑定
		stage.bind('keydown', function (e) {
			switch (e.keyCode) {
				case 13: //回车
				case 32: //空格
					_SCORE = 0;
					_LIFE = 3;
					game.setStage(1);
					break;
			}
		});
	})();
	game.init();
})();