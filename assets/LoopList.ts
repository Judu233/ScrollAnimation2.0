
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

    @property({
        displayName: `屏幕显示数量`,
        tooltip: `在屏幕上显示的个数，可见部分 `
    })
    showCount = 5;

    @property({
        displayName: `吸附功能`,
    })
    adsorptionFeatures = false;

    @property({
        displayName: `滑动切换功能`,
        tooltip: `类似卡片`,
        visible(this: LoopList) { return !this.adsorptionFeatures; }
    })
    slideTouch = false;

    @property({
        displayName: `滑动判断距离`,
        visible(this: LoopList) { return !this.adsorptionFeatures; }
    })
    slideDistence = 10;

    /*已经滑动的距离 */
    private _slideDis = 0;

    /**存放cellitem的数组列表 */
    private cellItemList: CellItem[] = [];

    /**在屏幕上跑的map */
    private cellItemMap: Map<string, CellItem> = new Map();

    /**是否在触摸滑动 */
    private isTouchMove = false;

    /**是否向右滑动 */
    private isSwipeRight = false;

    /**滑动加速值 =>加快item移动速度*/
    private swipeValue = 0;

    /**记录当前的全局实际的Index */
    private curCenterIndex = 0;
    /**全局实际最小index */
    private curMinIndex = 0;
    /**全局实际最大Index */
    private curMaxIndex = 0;

    /**全局中心虚拟index */
    private _fictitousCenterIndex = 0;
    public get fictitousCenterIndex() {
        return this._fictitousCenterIndex;
    }
    public set fictitousCenterIndex(value) {
        value = cc.misc.clampf(Math.abs(value), 0, this.testData.length);
        this._fictitousCenterIndex = value;
    }

    /**全局最大的虚拟Index */
    private fictitousMaxIndex = 0;
    /**全局最小的虚拟Index */
    private fictitousMinIndex = 0;

    /**测试数据 */
    private testData: string[] = [];

    onLoad() {
        this.initCells();
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

    private fo(count: number) {
        return (call: (i: number) => void) => {
            for (let ife = 0; ife < count; ife++)
                call && call.call(this, ife);
        };
    }

    /**初始化cellItem-> 计算progress->虚拟Index */
    initCells() {
        this.fo(15)(i => this.testData[i] = i.toString());

        //设置添加的根节点->存放cellItem的
        this.contentContainer = this.contentContainer == null ? this.node : this.contentContainer;
        //设置滑动
        this.slideTouch = !this.adsorptionFeatures;
        // cc.log(`吸附值：${this.adsorptionValue}`);

        //初始化最开始显示的item-
        let prefab = this.itemPrefab;
        let maxProgressIndex = 0;
        this.fictitousCenterIndex = 5;
        this.fo(this.showCount)(i => {
            let child = cc.instantiate(prefab);
            this.contentContainer.addChild(child);
            //设置进度位置
            let progressPos = 0.5 + i / this.showCount;
            let cellItem = child.getComponent(CellItem);
            cellItem.init(this, progressPos, i);
            cellItem.label.string = `index:(${i})`;
            if (progressPos <= 1) maxProgressIndex = i;

            this.cellItemList.push(cellItem);
            this.cellItemMap.set(i.toString(), cellItem);
        });

        //计算最小->中心 ， 中心->最大的虚拟值
        let overIndex = 0;
        let rightList = this.cellItemList.slice(0, maxProgressIndex + 1);
        rightList.forEach((cellItem, i) => {
            let index = this.fictitousCenterIndex + i;
            if (index >= this.testData.length) {
                index = ++overIndex;
            }
            cellItem.fictitousIndex = Number(this.testData[index]);
            cellItem.l2.string = this.testData[index];
        });
        overIndex = this.testData.length;
        let leftList = this.cellItemList.slice(maxProgressIndex + 1).reverse();
        leftList.forEach((cellItem, i) => {
            let index = this.fictitousCenterIndex - i - 1;
            if (index <= 0) {
                index = --overIndex;
            }
            cellItem.fictitousIndex = Number(this.testData[index]);
            cellItem.l2.string = this.testData[index];
        })

        //设置实际的index
        this.curCenterIndex = rightList[0].index;
        this.curMinIndex = leftList[leftList.length - 1].index
        this.curMaxIndex = rightList[rightList.length - 1].index;
        this.fictitousMaxIndex = rightList[rightList.length - 1].fictitousIndex;
        this.fictitousMinIndex = leftList[leftList.length - 1].fictitousIndex;
    }

    onTouchStart() {
        this._slideDis = 0;
    }

    onTouchMove(event: cc.Event.EventTouch) {
        //计算滑动距离
        let delta = event.getDelta().x / this.node.width; // >0 右移动， <0 左移动
        this.isSwipeRight = delta > 0;
        delta += (this.isSwipeRight ? this.swipeValue : - this.swipeValue) / 1000;
        this._slideDis += delta;
        this.isTouchMove = true;

        //滑动模式->不用更新progress直接最后更新
        if (this.slideTouch) return;

        //吸附模式->更新item位置progress和显示数据
        this.UpdateFictitousIndex(delta);
    }

    onTouchEnd() {
        if (this.adsorptionFeatures) {
            //吸附到目标
            this.adsorptionTotarget();
        } else if (this.slideTouch) {
            //滑动到目标
            this.slideTotarget();
        }
    }

    private UpdateFictitousIndex(delta: number) {
        let { centerIndex, maxIndex, minIndex } = this.getIndex();
        this.curCenterIndex = centerIndex;
        this.cellItemList.forEach(cellItem => {
            //因为 cell 受到动画控制，progress 只在 0 ~ 1 之间，只要取1的余数就自动循环了，从而避免复杂坐标运算。
            let progress = cellItem.progress;
            cellItem.progress = (progress + delta) % 1;
            // cc.log(`index:${cellItem.index},progress:${progress.toFixed(2)},虚拟index:${cellItem.fictitousIndex}`);
            cellItem._stopProgressAction();
        });

        //判断头或者尾部是否有需要更新虚拟Index
        let isArriveMax = maxIndex != this.curMaxIndex;
        let isArriveMin = minIndex != this.curMinIndex;
        if (isArriveMax || isArriveMin) {
            // cc.log(`maxIndex:${maxIndex},curMaxIndex:${this.curMaxIndex}`);
            this.curMinIndex = minIndex;
            this.curMaxIndex = maxIndex;
            let cellItem: CellItem;
            if (isArriveMax && this.isSwipeRight) {
                //向右滑动
                cellItem = this.cellItemList[this.curMinIndex];
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
            } else if (isArriveMin && !this.isSwipeRight) {
                //向左滑动
                cellItem = this.cellItemList[this.curMaxIndex];
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
            }
            cellItem.l2.string = this.testData[cellItem.fictitousIndex];
            cellItem.switchBeginningAndEnd();
            // cc.log(`小：${this.fictitousMinIndex}, 大：${this.fictitousMaxIndex}`);
        }
        // cc.log(`max:${this.fictitousMaxIndex},min:${this.fictitousMinIndex}`);
        // cc.log(`\n`)
    }

    private slideTotarget() {
        cc.log(`滑动距离:${this._slideDis}`);
        if (Math.abs(this._slideDis * 10) >= this.slideDistence) {
            let { centerIndex } = this.getIndex();
            let newList = [...this.cellItemList.slice(centerIndex), ...this.cellItemList.slice(0, centerIndex)];
            newList.forEach((cellItem, index) => {
                // this.UpdateFictitousIndex(0.02);
                // this.adsorptionTotarget();
                this.moveToTarget(cellItem, cellItem.progress + 0.2, () => {
                    this.isTouchMove = false;
                    // adsorptionCall && adsorptionCall();
                });
            })
            this._slideDis = 0;
        }
    }

    private adsorptionTotarget(adsorptionCall?: () => void) {
        let { centerIndex } = this.getIndex();
        let newList = [...this.cellItemList.slice(centerIndex), ...this.cellItemList.slice(0, centerIndex)];
        newList.forEach((cellItem, index) => {
            // cc.log(`移动信息：`, cellItem.index, cellItem.progress);
            let moveTarget = Math.abs(0.5 + index / this.showCount);
            moveTarget = moveTarget > 1 ? moveTarget % 1 : moveTarget;

            //小于0的提前设置,防止移动到错误的位置
            if (cellItem.progress < 0) {
                cellItem.progress = 1 - Math.abs(cellItem.progress);
                cellItem._applySetTime(cellItem.progress);
            }
            this.moveToTarget(cellItem, moveTarget, () => {
                this.isTouchMove = false;
                adsorptionCall && adsorptionCall();
            });
        });
    }

    /**
     *  移动元素item到目标
     *
     * @private
     * @param {CellItem} cellItem 移动元素item
     * @param {number} moveTarget 移动目标
     * @param {() => void} [playOverCall] 移动回调
     * @memberof LoopList
     */
    private moveToTarget(cellItem: CellItem, moveTarget: number, playOverCall?: () => void) {
        let smoothstep = (x: number, min: number, max: number) => {
            if (x <= min) return min;
            if (x >= max) return max;
            x = (x - min) / (max - min);
            return x;
        };
        let distence = Math.abs(moveTarget - cellItem.progress) * 10;
        let moveTime = smoothstep(distence / 3, 0.25, 0.4);
        let _i = 1;
        cellItem._stopProgressAction();
        cellItem._moveProgress = 0;
        cellItem._adsorptionAnim = (cc.tween(cellItem) as cc.Tween)
            .to(moveTime, {
                progress: moveTarget,
                _moveProgress: {
                    value: 1,
                    progress: function (start: number, end: number, current: number, ratio: number) {
                        let pro = start + (end - start) * ratio;
                        cc.log(_i);
                        if (Number(pro.toFixed(1)) > 0.2 * _i) {
                            _i++;
                            // cc.log(pro);
                        }
                        return pro;
                    }
                }
            }, cc.easeSineOut())
            .call(() => {
                cellItem._adsorptionAnim = null;
                // cc.log("吸附动画完成");
                playOverCall && playOverCall();
            })
            .start();
    }

    /**
     * 获取实际列表的index
     *
     * @private
     * @return {*} 中心，最大，最新的index
     * @memberof LoopList
     */
    private getIndex() {
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
}
