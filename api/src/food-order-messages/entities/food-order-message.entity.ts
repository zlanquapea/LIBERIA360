import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { FoodOrder } from "../../food-orders/entities/food-order.entity";
import { User } from "../../users/entities/user.entity";

/**
 * Threaded messages on a food order, between the buyer and the restaurant
 * owner — same shape and purpose as BookingMessage (see its doc comment),
 * kept in-platform rather than off to WhatsApp so it's visible to both
 * sides and not lost if someone clears their chat history. Deliberately
 * narrow: no attachments, no edit/delete (unlike booking messages — an
 * order's conversation is short-lived, "ready in 20 minutes"/"can you add
 * extra pepper", not the kind of thing worth rewriting after the fact).
 */
@Entity("food_order_messages")
export class FoodOrderMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => FoodOrder, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order: FoodOrder;

  @Index()
  @Column({ name: "order_id" })
  orderId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_user_id" })
  sender: User;

  @Column({ name: "sender_user_id" })
  senderUserId: string;

  @Column({ type: "text" })
  body: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  /** Set once the *other* participant has opened this order's thread after
   * this message was sent (see FoodOrderMessagesService.markRead) — lets
   * the sender's UI show a "Delivered" -> "Viewed" read receipt, same
   * convention as BookingMessage.readAt. Null until then. */
  @Column({ name: "read_at", type: "timestamp", nullable: true })
  readAt: Date | null;
}
