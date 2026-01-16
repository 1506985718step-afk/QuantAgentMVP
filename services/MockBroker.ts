import { TradeIntent, OrderStatus, Side, Position, BrokerOrder } from '../types';
import { generateId } from './mockData';

interface BrokerEvent {
    type: 'FILL' | 'REJECT' | 'PARTIAL';
    orderId: string;
    fillPrice: number;
    fillQty: number;
    timestamp: string;
    commission: number;
}

export class MockBrokerService {
    private orders: BrokerOrder[] = [];
    private eventQueue: BrokerEvent[] = [];
    
    // Cost Config
    private readonly COMMISSION_RATE = 0.00025;
    private readonly MIN_COMMISSION = 5.0;
    private readonly STAMP_DUTY = 0.001; // Sell only

    submitOrder(intent: TradeIntent): BrokerOrder {
        const order: BrokerOrder = {
            orderId: `ord-${generateId()}`,
            intentId: intent.intent_id,
            symbol: intent.symbol,
            side: intent.side,
            qty: intent.qty,
            filledQty: 0,
            price: intent.price,
            status: OrderStatus.SUBMITTED,
            submittedAt: Date.now()
        };
        this.orders.push(order);
        return order;
    }

    cancelOrder(intentId: string): boolean {
        const order = this.orders.find(o => o.intentId === intentId && o.status === OrderStatus.SUBMITTED);
        if (order) {
            order.status = OrderStatus.CANCELLED;
            return true;
        }
        return false;
    }

    // Called by Backend on every "tick" (or market update)
    processOrders(currentPrices: Record<string, number>): BrokerEvent[] {
        const events: BrokerEvent[] = [];
        const now = new Date().toISOString();

        for (const order of this.orders) {
            if (order.status !== OrderStatus.SUBMITTED && order.status !== OrderStatus.PARTIALLY_FILLED) continue;

            const marketPrice = currentPrices[order.symbol];
            if (!marketPrice) continue;

            // Matching Logic
            // Buy: Market Price <= Limit Price
            // Sell: Market Price >= Limit Price
            const canMatch = (order.side === Side.BUY && marketPrice <= order.price * 1.02) || // Allow 2% slippage tolerance for mock
                             (order.side === Side.SELL && marketPrice >= order.price * 0.98);

            if (canMatch) {
                // Simulate Partial Fills (10% chance)
                const isPartial = Math.random() < 0.1 && order.qty - order.filledQty > 100;
                
                let fillQty = order.qty - order.filledQty;
                if (isPartial) {
                    fillQty = Math.floor(fillQty / 2 / 100) * 100; // Fill half
                }

                // Simulate Slippage (-0.1% to +0.1%)
                const slippage = (Math.random() - 0.5) * 0.002;
                const fillPrice = marketPrice * (1 + slippage);

                // Calculate Costs
                const tradeVal = fillPrice * fillQty;
                let commission = Math.max(this.MIN_COMMISSION, tradeVal * this.COMMISSION_RATE);
                if (order.side === Side.SELL) {
                    commission += tradeVal * this.STAMP_DUTY;
                }

                // Update Order
                order.filledQty += fillQty;
                if (order.filledQty >= order.qty) {
                    order.status = OrderStatus.FILLED;
                } else {
                    order.status = OrderStatus.PARTIALLY_FILLED;
                }

                events.push({
                    type: isPartial ? 'PARTIAL' : 'FILL',
                    orderId: order.orderId,
                    fillPrice: Number(fillPrice.toFixed(2)),
                    fillQty: fillQty,
                    timestamp: now,
                    commission: Number(commission.toFixed(2))
                });
            }
        }

        return events;
    }

    getOrders() {
        return this.orders;
    }
}