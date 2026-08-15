import { User } from "./entities/user.entity";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  authProvider: string;
  homeCounty: User["homeCounty"];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  travelerType: User["travelerType"];
  interests: string[];
  createdAt: Date;
}

/** Strips passwordHash (and anything else internal) before a User ever leaves the API. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    authProvider: user.authProvider,
    homeCounty: user.homeCounty,
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin,
    travelerType: user.travelerType,
    interests: user.interests,
    createdAt: user.createdAt,
  };
}
