
import CellItem from "./CellItem";

const { ccclass, property } = cc._decorator;

/**
 *  注意 cellItem的动画的[位置属性x,y,z]不能加缓动（其他属性可以缓动），否则会出现错位，要修改归为的缓动请直接缓动属性progress
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
        displayName: `切换`,
        tooltip: `类似卡片滑动切换`,
        visible(this: LoopList) { return !this.adsorptionFeatures; }
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
        tooltip: ``,
        visible(this: LoopList) { return !this.adsorptionFeatures && !this.slideTouch; }
    })
    inertia = false;

    @property({
        displayName: `减速率`,
        tooltip: ``,
        visible(this: LoopList) { return this.inertia; }
    })
    decelerationRate = 5;

    /**是否在触摸滑动 */
    private isTouchMove = false;
    /**是否向右滑动 */
    private isSwipeRight = false;

    /**存放cellitem的数组列表 */
    private cellItemList: CellItem[] = [];
    /**map */
    private cellItemMap: Map<string, CellItem> = new Map();

    /*已经滑动的距离 */
    private _slideDis = 0;
    /**是否可以滑动 */
    private _isCanSlide = true;
    /**惯性dt */
    private _inertiaDt = 0;
    /**是否正在惯性滑动 */
    private _isInertiaSlide = false;
    /**惯性滚动速度 */
    private _inertiaSpeed = 0;
    /**衰减值 */
    private attenuationValue = 0;
    /**总衰减度 */
    private allAttenuation = 0;

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
    //#endregion

    /**测试数据 */
    testData: string[] = [];

    onLoad() {
        this.initCellsList();
    }

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

    /**
     * 初始化cellItem-> 计算progress->虚拟Index
     *
     * @memberof LoopList
     */
    initCellsList() {
        //初始化数据
        this.for(15)(i => this.testData[i] = i.toString());
        //设置添加的根节点->存放cellItem的
        this.contentContainer = this.contentContainer == null ? this.node : this.contentContainer;

        //初始化最开始显示的item-
        let prefab = this.itemPrefab;
        let maxProgressIndex = 0;
        this.fictitousCenterIndex = 5;  //开始的虚拟index
        this.for(this.showCount)(i => {
            let child = cc.instantiate(prefab);
            this.contentContainer.addChild(child);

            //设置进度位置
            let progressPos = 0.5 + i / this.showCount;
            let cellItem = child.getComponent(CellItem);
            cellItem.init(this, progressPos, i);
            if (progressPos <= 1) maxProgressIndex = i;

            this.cellItemList.push(cellItem);
            this.cellItemMap.set(i.toString(), cellItem);
        });

        //初始虚拟值
        let initFitousIndex = (item: CellItem, index: number) => {
            item.fictitousIndex = Number(this.testData[index]);
            item.l2.string = this.testData[index];
        };
        // 计算中心->最大的虚拟值
        let overIndex = 0;
        let rightList = this.cellItemList.slice(0, maxProgressIndex + 1);
        rightList.forEach((cellItem, i) => {
            let index = this.fictitousCenterIndex + i;
            if (index >= this.testData.length) {
                index = ++overIndex;
            }
            initFitousIndex(cellItem, index);
        });
        overIndex = this.testData.length;
        //计算最小->中心的虚拟值
        let leftList = this.cellItemList.slice(maxProgressIndex + 1).reverse();
        leftList.forEach((cellItem, i) => {
            let index = this.fictitousCenterIndex - i - 1;
            if (index <= 0) {
                index = --overIndex;
            }
            initFitousIndex(cellItem, index);
        });

        //设置相应的index
        this.curCenterIndex = rightList[0].index;
        this.curMinIndex = leftList[leftList.length - 1].index
        this.curMaxIndex = rightList[rightList.length - 1].index;
        this.fictitousMaxIndex = rightList[rightList.length - 1].fictitousIndex;
        this.fictitousMinIndex = leftList[leftList.length - 1].fictitousIndex;
    }

    onTouchStart() {
        this._slideDis = 0;
        this._inertiaDt = 0;
        this._isInertiaSlide = false;
    }

    onTouchMove(event: cc.Event.EventTouch) {
        //计算滑动距离
        let delta = event.getDelta().x / this.node.width;
        this.isSwipeRight = delta > 0; // >0 右移动， <0 左移动
        delta += (this.isSwipeRight ? this.swipeValue : - this.swipeValue) / 1000;
        this._slideDis += delta;
        this.isTouchMove = true;

        //滑动模式->不用更新progress直接最后更新 吸附模式->更新item位置progress和显示数据
        if (this.adsorptionFeatures || !this.slideTouch) {
            this.updateProgress(delta);
            this.updateFictitousIndex();
        }
    }

    onTouchEnd() {
        if (this.adsorptionFeatures) {
            this._adsorptionTotarget(() => {
                this.isTouchMove = false;
                this._isCanSlide = true;
                this.updateFictitousIndex();
            });//吸附到最近的目标
        } else if (this.slideTouch) {
            this._slideToTarget(() => {
                this.isTouchMove = false;
                this._isCanSlide = true;
                this.updateFictitousIndex();
            }); //滑动一个单位
        } else if (this.inertia) {
            //计算启动惯性的条件 ：当用户滚动的距离足够大（大于 15px）和持续时间足够短（小于 300ms）时
            if (this._slideDis > 15 && this._inertiaDt < 0.3) {
                this._isInertiaSlide = true;
                this.attenuationValue = 1;
                this.allAttenuation = 10;
            }
            this.isTouchMove = false;
        }
    }

    /**
     * 切换滑动模式 --吸附滑动，卡片距离滑动，基本滑动
     *
     * @memberof LoopList
     */
    switchTouchMode(e, mode: string) {
        switch (mode) {
            case "1":
                this.slideTouch = true;
                this.adsorptionFeatures = false;
                break;
            case "2":
                this.slideTouch = false;
                this.adsorptionFeatures = true;
                break;
            case "3":
                this.slideTouch = false;
                this.adsorptionFeatures = false;
                break;
            default:
                break;
        }
    }

    /**
     * 点击向左/右滑动一个单位
     *
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
        }); //滑动一个单位
    }

    /**
     * 更新item的数据
     *  
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
     *
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
    private for(count: number) {
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
            this.fictitousMinIndex = this.testData.length - 1;
        if (this.fictitousMaxIndex < 0)
            this.fictitousMaxIndex = this.testData.length - 1;

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
        if (this.fictitousMaxIndex == this.testData.length - 1) { //最大到达边界
            this.fictitousMaxIndex = 0;
            this.fictitousMinIndex++;
        }
        else if (this.fictitousMinIndex == this.testData.length - 1) { //最小到达边界
            this.fictitousMinIndex = 0;
            this.fictitousMaxIndex++;
        }
        else {
            this.fictitousMaxIndex++;
            this.fictitousMinIndex++;
        }

        if (this.fictitousMinIndex > this.testData.length - 1)
            this.fictitousMinIndex = 0;
        if (this.fictitousMaxIndex > this.testData.length - 1)
            this.fictitousMaxIndex = 0;

        cellItem.fictitousIndex = this.fictitousMaxIndex;
        return cellItem;
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
            //移动item
            newList.forEach((cellItem) => {
                let moveTarget = cellItem.progress + moveDistence;
                // cc.log(`moveTarget: ${moveTarget.toFixed(1)}, progress:${cellItem.progress.toFixed(1)}`);
                this._moveToTarget(cellItem, moveTarget, () => {
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

            // cc.log(`移动信息：index:${cellItem.index}, progress:${cellItem.progress.toFixed(1)}, moveTarget:${moveTarget.toFixed(1)}`);
            //小于0的提前设置,防止移动到错误的位置
            if (cellItem.progress < 0) {
                cellItem.progress = 1 - Math.abs(cellItem.progress);
                cellItem._applySetTime(cellItem.progress);
            }
            //移动item
            this._moveToTarget(cellItem, moveTarget, () => {
                adsorptionCall && adsorptionCall();
            });
        });
        // cc.log(`-------`);
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
        let smoothstep = (x: number, min: number, max: number) => {
            if (x <= min) return min;
            if (x >= max) return max;
            x = (x - min) / (max - min);
            return x;
        };
        //计算吸附平滑时间区间
        let distence = Math.abs(moveTarget - cellItem.progress) * 10;
        let moveTime = smoothstep(distence / 3, 0.25, 0.4);
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

    update(dt: number) {
        if (this.inertia) {
            if (this._isInertiaSlide) {
                if (this.allAttenuation <= 0) {
                    this._isInertiaSlide = false;
                    return;
                }
                //开始惯性滑动
                // 累计progress - dt * 衰减
                let attenuation = dt * this.attenuationValue;
                this.allAttenuation -= attenuation;
                this.updateProgress(attenuation)
            } else if (this.isTouchMove) {
                this._inertiaDt += dt;
            }
        }
    }
    //#endregion
}
