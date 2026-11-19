/** Friend links shown on the About page. Icons are copied into /public/friends so they load without hotlinking. */
export interface FriendLink {
  name: string;
  url: string;
  icon: string;
}

export const FRIEND_LINKS: FriendLink[] = [
  { name: "色妹妹的裙底", url: "https://gh.sbchild.top/", icon: "/friends/sbchild.webp" },
];
