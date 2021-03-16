/*
 * @features: 循环虚拟列表
 * @description: 实现的滑动列表
 * @Date: 2021-03-16 14:13:23
 * @Author: judu233(769471424@qq.com)
 * @LastEditTime: 2021-03-16 19:22:42
 * @LastEditors: judu233
 */

import CellItem from "./CellItem";
const { ccclass, property } = cc._decorator;

export interface ILoopListData {
    index: string;
}

/**
 *  !!注意 cellItem的动画的[位置属性x,y,z]不能加缓动（其他属性可以缓动），否则会出现错位，如要修改缓动请直接缓动属性progress
 *  !!注意如果有节点的属性被设置在总的默认clip里运行，在脚本里动态设置该节点的属性将无效,请单独设置该节点的动画
 */
@ccclass
export default class LoopList extends cc.Component {
    @property({
        displayName: `列表的容器`,
        tooltip: `显示列表容器，如果为空，本节点添加`,
        type: cc.Node,
    })
    contentContainer: cc.Node = null;

    @property({
        displayName: `itemPrefab`,
        tooltip: `列表容器item里的预制体`,
        type: cc.Prefab
    })
    itemPrefab: cc.Prefab = null;

    @property({
        displayName: `开始虚拟index`,
        tooltip: `最开始显示的虚拟Index`,
        min: 0,
        type: cc.Integer,
    })
    startFictitousIndex = 0;

    @property
    private _showCount = 5;
    @property({
        displayName: `屏幕显示数量`,
        tooltip: `在屏幕上显示的个数，可见部分, 双数会出bug `
    })
    public set showCount(v: number) {
        if (v < 3) v = 3;
        if (v % 2 == 0) v -= 1;
        this._showCount = v;
    }
    public get showCount() { return this._showCount; }

    @property({
        displayName: `滑动加速值`,
        tooltip: `加快item移动速度，不包括卡片滑动，数值越大，滑动越快`,
    })
    swipeValue = 2;

    @property({
        displayName: `吸附`,
        tooltip: `自动吸附到最近计算好的item位置`
    })
    adsorptionFeatures = false;

    @property({
        displayName: `吸附速度`,
        tooltip: `值越大，吸附速度越快`,
        min: 0,
        visible(this: LoopList) { return this.adsorptionFeatures; }
    })
    adsorptionSpeed = 5;

    @property({
        displayName: `吸附时间区间`,
        tooltip: `吸附动画的时间插值计算在区间内`,
        visible(this: LoopList) { return this.adsorptionFeatures; }
    })
    adsorptionSection: cc.Vec2 = cc.v2(0.25, 0.4);

    @property({
        displayName: `切换`,
        tooltip: `类似卡片滑动切换`,
        visible(this: LoopList) { return this.adsorptionFeatures; }
    })
    slideTouch = false;

    @property({
        displayName: `切换距离`,
        tooltip: `手指距离超过该数值才触发移动，数值越小越容易触发`,
        visible(this: LoopList) { return !this.adsorptionFeatures && this.slideTouch; }
    })
    slideDistence = 10;

    @property({
        displayName: `惯性`,
        tooltip: `滑动结束时，带有惯性的滚动`,
        visible(this: LoopList) { return !this.slideTouch; }
    })
    inertia = false;

    @property({
        displayName: `惯性衰减值`,
        tooltip: `值越大，衰减速度越快,注意该值为0时，将开启无限滚动`,
        min: 0,
        visible(this: LoopList) { return this.inertia && !this.slideTouch; }
    })
    inertiaSpeedAttenuation = 1;

    @property({
        displayName: `惯性开启距离`,
        tooltip: `该值越小，越容易触发惯性滑动检测`,
        min: 0,
        visible(this: LoopList) { return this.inertia && !this.slideTouch; }
    })
    inertiaStartDistence = 0.1;

    @property({
        displayName: `惯性开启时间`,
        tooltip: `该值越大，越容易触发惯性滑动检测`,
        min: 0,
        visible(this: LoopList) { return this.inertia && !this.slideTouch; }
    })
    inertiaStartTime = 0.5;

    /**存储的数据 */
    ListData: ILoopListData[] = [];

    /**存放cellitem的数组列表 */
    cellItemList: CellItem[] = [];

    /**惯性滑动回调 */
    inertiaOverCall: () => void;

    /**是否在触摸滑动 */
    isTouchMove = false;
    /**是否向右滑动 */
    isSwipeRight = false;

    /**map */
    private cellItemMap: Map<string, CellItem> = new Map();

    /*已经滑动的距离 */
    private _slideDis = 0;
    /**是否可以滑动 */
    private _isCanSlide = true;
    /**是否正在惯性滑动 */
    private _isInertiaSlide = false;
    /**惯性dt */
    private _inertiaDt = 0;
    /**惯性滚动速度 */
    private _inertiaSpeed = 0;

    /**惯性结束回调 */
    private _inertiaOverCall: () => void;
    /**惯性结束后，如果有开启吸附的吸附结束回调 */
    private _inertiaAdsortionOverCall: () => void;

    //#region index
    /**记录当前的全局实际的Index */
    private curCenterIndex = 0;
    /**全局实际最小index */
    private curMinIndex = 0;
    /**全局实际最大Index */
    private curMaxIndex = 0;

    /**全局中心虚拟index */
    private fictitousCenterIndex = 0;
    /**全局最大的虚拟Index */
    private fictitousMaxIndex = 0;
    /**全局最小的虚拟Index */
    private fictitousMinIndex = 0;

    /**实际最大progess的item序列 （不超过1的progress）*/
    private _maxIndexOfProgress = 0;
    //#endregion

    onLoad() {
        //初始化存入数据--测试
        // this._for(15)(i => this.ListData[i] = { index: `${i}` });
        //初始化数据
        // this.initCellsList();
    }

    /**
     * 初始化cellItem-> 计算progress->虚拟Index
     * @memberof LoopList
     */
    initCellsList() {
        try {
            //设置添加的根节点->存放cellItem的
            this.contentContainer = this.contentContainer == null ? this.node : this.contentContainer;
            //重新设置maxIndex
            this._maxIndexOfProgress = 0;
            //限制开始虚拟index不超数据长度
            this.fictitousCenterIndex = cc.misc.clampf(this.startFictitousIndex, 0,
                cc.misc.clampf(this.ListData.length - 1, 0, this.ListData.length - 1));
            //初始化最开始显示的item-
            this._for(this.showCount)(i => {
                //设置进度位置
                let progressPos = 0.5 + i / this.showCount;
                let cellItem = this._getItemNode().getComponent(CellItem);
                cellItem.init(this, progressPos, i);
                if (progressPos <= 1) this._maxIndexOfProgress = i;

                //存储item
                this.cellItemList.push(cellItem);
                this.cellItemMap.set(i.toString(), cellItem);
            });
            //设置对应index
            this._setAllIndex(this._maxIndexOfProgress);

        } catch (error) {
            cc.error(`LoopList:初始化列表失败`, error);
            return;
        }
    }

    //#region 周期函数
    onEnable() {
        this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(cc.Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDisable() {
        this.node.off(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(cc.Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onTouchStart() {
        this._slideDis = 0;
        this._inertiaDt = 0;
        this._isInertiaSlide = false;
    }

    onTouchMove(event: cc.Event.EventTouch) {
        //计算滑动距离
        let delta = event.getDelta().x / this.node.width;
        //>0 右移动，<0 左移动
        this.isSwipeRight = delta > 0;
        //计算滑动值
        delta += (this.isSwipeRight ? this.swipeValue : - this.swipeValue) / 1000;
        this._slideDis += delta;
        this.isTouchMove = true;

        //滑动模式->不用更新progress直接最后更新 吸附模式->更新item位置progress和显示数据
        if (!this.slideTouch) {
            this.updateProgress(delta);
            this.updateFictitousIndex();
        }
    }

    onTouchEnd() {
        if (this.inertia && !this._isInertiaSlide) {
            this._startingInertia(() => {
                //停止惯性滚动
                this.inertiaOverCall && this.inertiaOverCall();
            }, () => {

            }, () => {

            });
        } else if (this.slideTouch) {
            this._slideToTarget(() => {
                //停止滑动一个单位

            });
        } else if (this.adsorptionFeatures && !this._isInertiaSlide) {
            this._adsorptionTotarget(() => {

            });
        }
    }

    update(dt: number) {
        if (this.inertia) {
            this._updateInertia(dt);
        }
    }

    //#endregion周期函数

    /**
     * 切换滑动模式 --吸附滑动，卡片距离滑动，基本滑动
     * @memberof LoopList
     */
    switchTouchMode(e, mode: string) {
        switch (mode) {
            case "1":
                this.slideTouch = true;
                this.adsorptionFeatures = false;
                this.inertia = false;
                break;
            case "2":
                this.slideTouch = false;
                this.adsorptionFeatures = true;
                this.inertia = false;
                break;
            case "3":
                this.slideTouch = false;
                this.adsorptionFeatures = false;
                this.inertia = true;
                break;
            case "4":
                this.slideTouch = false;
                this.adsorptionFeatures = false;
                this.inertia = false;
                break;
            default:
                break;
        }
    }

    /**
     * 开启/关闭吸附
     *
     * @memberof LoopList
     */
    switchAdsorption() {
        this.adsorptionFeatures = !this.adsorptionFeatures;
    }

    /**
     * 点击向左/右滑动一个单位
     * @param {*} e 点击事件
     * @param {string} dir 方向 
     * @memberof LoopList
     */
    clickSwipe(e: any, dir: string) {
        this._slideDis = Number(dir);
        this._slideToTarget(() => {
            this.isTouchMove = false;
            this._isCanSlide = true;
            this._isCanSlide = true;
            this.updateFictitousIndex();
        });
    }

    /**
     * 重新初始化
     * @memberof LoopList
     */
    reload() {
        this.clear();
        this.initCellsList();
    }

    /**
     * 清理场景列表的节点
     * @memberof LoopList
     */
    clear() {
        this.cellItemList.forEach(cellItem => this._putItemNode(cellItem.node));
    }

    /**
     * 向数据列表里添加数据
     * @param {ILoopListData} data 数据
     * @memberof LoopList
     */
    addData(data: ILoopListData) {
        let len = this.ListData.length - 1;
        this.ListData[len + 1] = data;
    }

    /**
     * 更新item的数据
     * @private
     * @param {CellItem} [cellItem] 要更新虚拟index的item
     * @memberof LoopList
     */
    private updateCellItemData(cellItem?: CellItem) {
        if (cellItem) {
            try {
                // cc.log(`更新cellIndex:${cellItem.index},cellItem:`, cellItem);
                cellItem.updateItemData();
            } catch (error) {
                cc.error(`更新cellItem出错`, cellItem);
            }
        }
    }

    /**
     *更新列表的progress
     *
     * @private
     * @param {number} delta 更新值
     * @memberof LoopList
     */
    private updateProgress(delta: number) {
        this.cellItemList.forEach(cellItem => {
            //因为 cell 受到动画控制，progress只要取1的余数就自动循环了，从而避免复杂坐标运算。
            let progress = cellItem.progress;
            cellItem.progress = (progress + delta) % 1;
            cellItem._stopProgressAction();
            // cc.log(`index:${cellItem.index},progress:${progress.toFixed(2)},虚拟index:${cellItem.fictitousIndex}`);
        });
    }

    /**
     * 判断更新头/尾部需要更新虚拟index的cellItem
     * @private
     * @memberof LoopList
     */
    private updateFictitousIndex() {
        let { centerIndex, maxIndex, minIndex } = this._getIndex();
        this.curCenterIndex = centerIndex;

        //判断头或者尾部是否有需要更新虚拟Index
        let isArriveMax = maxIndex != this.curMaxIndex;
        let isArriveMin = minIndex != this.curMinIndex;
        if (isArriveMax || isArriveMin) {
            // isArriveMax && cc.log(`maxIndex:${maxIndex},curMaxIndex:${this.curMaxIndex}`);
            // isArriveMin && cc.log(`minIndex:${minIndex},curMinIndex:${this.curMinIndex}`);
            this.curMinIndex = minIndex;
            this.curMaxIndex = maxIndex;
            let cellItem: CellItem;
            if (isArriveMax && this.isSwipeRight) {
                cellItem = this._getUpdateFictitousReduce();//向右滑动 ->  虚拟index减少
            } else if (isArriveMin && !this.isSwipeRight) {
                cellItem = this._getUpdateFictitousAdd();//向左滑动 虚拟index增加
            }
            this.updateCellItemData(cellItem);
            // cc.log(`小：${this.fictitousMinIndex}, 大：${this.fictitousMaxIndex}`);
        }
        // cc.log(`\n`)
    }

    //#region 
    /**
     * 根据最大item设置相应的index
     * @private
     * @param {number} maxProgressIndex 最大不超过1的progress进度的item
     * @memberof LoopList
     */
    private _setAllIndex(maxProgressIndex: number) {
        let overIndex = 0;
        let rightList = this.cellItemList.slice(0, maxProgressIndex + 1);
        // 计算中心->最大的虚拟值
        rightList.forEach((cellItem, i) => {
            let index = this.fictitousCenterIndex + i;
            if (index >= this.ListData.length) {
                index = ++overIndex;
            }
            cellItem.initFitousIndex(index);
        });
        overIndex = this.ListData.length;
        //计算最小->中心的虚拟值
        let leftList = this.cellItemList.slice(maxProgressIndex + 1).reverse();
        leftList.forEach((cellItem, i) => {
            let index = this.fictitousCenterIndex - i - 1;
            if (index <= 0) {
                index = --overIndex;
            }
            cellItem.initFitousIndex(index);
        });

        //设置相应位置的index
        this.curCenterIndex = rightList[0].index;
        this.curMinIndex = leftList[leftList.length - 1].index;
        this.curMaxIndex = rightList[rightList.length - 1].index;
        this.fictitousMaxIndex = rightList[rightList.length - 1].fictitousIndex;
        this.fictitousMinIndex = leftList[leftList.length - 1].fictitousIndex;
    }

    /**存放item节点的对象池 */
    private _itemNodePool: cc.NodePool = new cc.NodePool(`LoopList_itemList`);
    /**
     * 从节点池中获取节点，节点池不够的话直接克隆一个
     * @private
     * @return {*} 节点
     * @memberof LoopList
     */
    private _getItemNode() {
        try {
            let item = this._itemNodePool.get();
            if (!item) {
                item = cc.instantiate(this.itemPrefab);
                this.contentContainer.addChild(item);
            }
            return item;
        } catch (error) {
            cc.error(`LoopList_itemList获取节点失败`);
        }
    }

    /**
     * 存入节点池
     * @private
     * @param {cc.Node} item 节点
     * @memberof LoopList
     */
    private _putItemNode(item: cc.Node) {
        if (item && item instanceof cc.Node)
            this._itemNodePool.put(item);
        else
            cc.warn(`LoopList_itemList存储节点失败！`, item);
    }
    /**
     *  向左/右滑动一个单位
     *  注意:移动多个单位会有数据延迟，目前支持移动一个单位
     * @private
     * @param {() => void} [slideCall] 滑动完成回调
     * @memberof LoopList
     */
    private _slideToTarget(slideCall?: () => void) {
        // cc.log(`滑动距离:${this._slideDis}`);
        if (Math.abs(this._slideDis * 1000) >= this.slideDistence && this._isCanSlide) {
            this._isCanSlide = false;
            this.isSwipeRight = this._slideDis > 0;

            let { centerIndex, maxIndex, minIndex } = this._getIndex();
            let newList = [...this.cellItemList.slice(centerIndex), ...this.cellItemList.slice(0, centerIndex)];
            let moveDistence = 1 / (this.isSwipeRight ? this.showCount : -this.showCount);
            let listLen = this.cellItemList.length - 1;
            let cellItem: CellItem;
            //提前更新要切换的虚拟item的index
            if (this.isSwipeRight) {
                this.curCenterIndex = (centerIndex - 1 < 0) ? listLen : centerIndex - 1;
                this.curMaxIndex = (maxIndex - 1 < 0) ? listLen : maxIndex - 1;
                this.curMinIndex = (minIndex - 1 < 0) ? listLen : minIndex - 1;
                cellItem = this._getUpdateFictitousReduce();
            } else {
                this.curCenterIndex = (centerIndex + 1 > listLen) ? 0 : centerIndex + 1;
                this.curMaxIndex = (maxIndex + 1 > listLen) ? 0 : maxIndex + 1;
                this.curMinIndex = (minIndex + 1 > listLen) ? 0 : minIndex + 1;
                cellItem = this._getUpdateFictitousAdd();
            }
            this.fictitousCenterIndex = this.cellItemList[this.curCenterIndex].fictitousIndex;
            this.updateCellItemData(cellItem);
            //对列表容器中item进行移动
            newList.forEach((cellItem) => {
                let moveTarget = cellItem.progress + moveDistence;
                // cc.log(`moveTarget: ${moveTarget.toFixed(1)}, progress:${cellItem.progress.toFixed(1)}`);
                this._moveToTarget(cellItem, moveTarget, () => {
                    this.isTouchMove = false;
                    this._isCanSlide = true;
                    this.updateFictitousIndex();
                    slideCall && slideCall();
                });
            })
            this._slideDis = 0;
        }
    }

    /**
     * 吸附到附近最近的一个目标
     * @private
     * @param {() => void} [adsorptionCall] 吸附完成回调
     * @memberof LoopList
     */
    private _adsorptionTotarget(adsorptionCall?: () => void) {
        let { centerIndex } = this._getIndex();
        let newList = [...this.cellItemList.slice(centerIndex), ...this.cellItemList.slice(0, centerIndex)];

        this.fictitousCenterIndex = this.cellItemList[centerIndex].fictitousIndex;
        newList.forEach((cellItem, index) => {
            let moveTarget = Math.abs(0.5 + index / this.showCount);
            moveTarget = moveTarget > 1 ? moveTarget % 1 : moveTarget;

            //小于0的提前设置,防止错误移动
            if (cellItem.progress < 0) {
                cellItem.progress = 1 - Math.abs(cellItem.progress);
            }
            // cc.log(`移动信息：index:${cellItem.index}, progress:${cellItem.progress.toFixed(1)}, moveTarget:${moveTarget.toFixed(1)}`);
            this._moveToTarget(cellItem, moveTarget, () => {
                this.isTouchMove = false;
                this._isCanSlide = true;
                this.updateFictitousIndex();
                adsorptionCall && adsorptionCall();
            });
        });
        // cc.log(`-------`);
    }

    /**
     *  开启惯性滑动
     * @private
     * @param {() => void} [inertiaOverCall] 惯性滑动停止回调
     * @param {() => void} [inertiaAdsortionOverCall] 惯性滑动结束后，吸附滑动停止回调
     * @param {() => void} [adsorptionCall] 没有触发惯性滑动，但开启了吸附滑动的停止回调
     * @memberof LoopList
     */
    private _startingInertia(inertiaOverCall?: () => void, inertiaAdsortionOverCall?: () => void, adsorptionCall?: () => void) {
        this._stopAllAnim();
        this._inertiaSpeed = 0;
        //计算启动惯性的条件 ：当用户滚动的距离足够大（大于 15px）和持续时间足够短（小于 300ms）时
        if (Math.abs(this._slideDis) > this.inertiaStartDistence && this._inertiaDt < this.inertiaStartTime) {
            this._isInertiaSlide = true;
            this._inertiaOverCall = inertiaOverCall;
            this._inertiaAdsortionOverCall = inertiaAdsortionOverCall;
            this.isSwipeRight = this._slideDis > 0;
            this._inertiaSpeed = Math.abs(this._slideDis / this._inertiaDt);
        } else if (this.adsorptionFeatures) {
            this._stopAllAnim();
            this._adsorptionTotarget(() => {
                adsorptionCall && adsorptionCall();
            });
        } else this.isTouchMove = false;
    }

    /**
     * 更新惯性滑动
     *
     * @param {number} dt 时间
     * @return {*} 
     * @memberof LoopList
     */
    _updateInertia(dt: number) {
        if (this._isInertiaSlide) {
            if (this._inertiaSpeed <= 0.05) {
                //速度小于0.01停止滚动
                this._isInertiaSlide = false;
                this._inertiaSpeed = 0;
                this._inertiaOverCall && this._inertiaOverCall();
                if (this.adsorptionFeatures)
                    this._adsorptionTotarget(() => {
                        this._inertiaAdsortionOverCall && this._inertiaAdsortionOverCall();
                    });
                return;
            }
            //开始惯性滑动
            let attenuation = dt * this._inertiaSpeed * (this.isSwipeRight ? 1 : -1);
            this._inertiaSpeed = cc.misc.lerp(this._inertiaSpeed, 0, this.inertiaSpeedAttenuation / 100);
            this.updateProgress(attenuation);
            this.updateFictitousIndex();
        } else if (this.isTouchMove) {
            this._inertiaDt += dt;
        }
    }

    /**
     * 一个遍历指定返回函数的方法
     * @private
     * @param {number} count 遍历次数
     * @return {*} 遍历的方法
     * @memberof LoopList
     */
    private _for(count: number) {
        return (call: (i: number) => void) => {
            for (let ife = 0; ife < count; ife++)
                call && call.call(this, ife);
        };
    }
    /**
     * 获取列表最小item，并更新虚拟Index 
     * @private
     * @return {*} CellItem
     * @memberof LoopList
     */
    private _getUpdateFictitousReduce(): CellItem {
        let cellItem = this.cellItemList[this.curMinIndex];
        if (this.fictitousMinIndex == 1) {
            this.fictitousMinIndex = 0;
            this.fictitousMaxIndex--;
        }
        else if (this.fictitousMaxIndex == 1) {
            this.fictitousMinIndex--;
            this.fictitousMaxIndex = 0;
        }
        else {
            this.fictitousMaxIndex--;
            this.fictitousMinIndex--;
        }

        if (this.fictitousMinIndex < 0)
            this.fictitousMinIndex = this.ListData.length - 1;
        if (this.fictitousMaxIndex < 0)
            this.fictitousMaxIndex = this.ListData.length - 1;

        cellItem.fictitousIndex = this.fictitousMinIndex;
        return cellItem;
    }

    /**
     * 获取列表最大item，并更新虚拟index更新
     * @private
     * @return {*} CellItem
     * @memberof LoopList
     */
    private _getUpdateFictitousAdd(): CellItem {
        let cellItem = this.cellItemList[this.curMaxIndex];
        if (this.fictitousMaxIndex == this.ListData.length - 1) { //最大到达边界
            this.fictitousMaxIndex = 0;
            this.fictitousMinIndex++;
        }
        else if (this.fictitousMinIndex == this.ListData.length - 1) { //最小到达边界
            this.fictitousMinIndex = 0;
            this.fictitousMaxIndex++;
        }
        else {
            this.fictitousMaxIndex++;
            this.fictitousMinIndex++;
        }

        if (this.fictitousMinIndex > this.ListData.length - 1)
            this.fictitousMinIndex = 0;
        if (this.fictitousMaxIndex > this.ListData.length - 1)
            this.fictitousMaxIndex = 0;

        cellItem.fictitousIndex = this.fictitousMaxIndex;
        return cellItem;
    }

    /**
     *  移动元素item到目标
     * @private
     * @param {CellItem} cellItem 移动元素item
     * @param {number} moveTarget 移动目标
     * @param {() => void} [playOverCall] 移动回调
     * @memberof LoopList
     */
    private _moveToTarget(cellItem: CellItem, moveTarget: number, playOverCall?: () => void) {
        let distence = Math.abs(moveTarget - cellItem.progress) / this.adsorptionSpeed * 100;
        let x = this.adsorptionSection.x, y = this.adsorptionSection.y;
        cc.misc.clampf(x, 0, x);
        cc.misc.clampf(y, 0, y);

        //进行吸附时间插值计算
        let moveTime = cc.misc.lerp(x, y, distence);
        moveTime = cc.misc.clampf(moveTime, x, y);
        cellItem._stopProgressAction();
        cellItem._adsorptionAnim = (cc.tween(cellItem) as cc.Tween)
            .to(moveTime, { progress: moveTarget }, cc.easeSineOut())
            .call(() => {
                cellItem._adsorptionAnim = null;
                cellItem._applySetTime();
                // cc.log("吸附动画完成");
                playOverCall && playOverCall();
            })
            .start();
    }

    /**
     * 停止列表中所有的动画
     * @private
     * @memberof LoopList
     */
    private _stopAllAnim() {
        this.cellItemList.forEach(item => item._stopProgressAction());
    }

    /**
     * 获取实际列表的index
     * @private
     * @return {*} 中心，最大，最新的index
     * @memberof LoopList
     */
    private _getIndex(): any {
        let centerIndex = 0, centerDis = 2;
        let maxIndex = 0, maxDis = 0;
        let minIndex = 0, minDis = 0;
        for (let [index, item] of this.cellItemList.entries()) {
            let progress = item.progress;
            let centerProgress = Math.abs(progress + (progress > 0 ? -0.5 : 0.5));
            if (centerProgress < centerDis) {
                centerIndex = index;
                centerDis = centerProgress;
            }
            let maxProgress = Math.abs(progress + (progress > 0 ? 0 : 1));
            if (maxProgress > maxDis) {
                maxIndex = index;
                maxDis = maxProgress;
            }
            let minProgress = Math.abs(progress + (progress > 0 ? -1 : 0));
            if (minProgress > minDis) {
                minIndex = index;
                minDis = minProgress;
            }
            // cc.log(`中心：${centerProgress.toFixed(1)}, 最大：${maxProgress.toFixed(1)}, 最小：${minProgress.toFixed(1)}\n`);
        }
        // cc.log(`中心：${centerIndex}, 最小：${minIndex}, 最大：${maxIndex}`);
        // cc.log(`---------------------`)
        return { centerIndex, maxIndex, minIndex };
    }
    //#endregion
}
