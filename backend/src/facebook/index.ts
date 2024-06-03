import { Users } from '@prisma/client';
import * as bizSdk from 'facebook-nodejs-business-sdk';
const EventRequest = bizSdk.EventRequest;
const UserData = bizSdk.UserData;
const ServerEvent = bizSdk.ServerEvent;

const access_token = process.env.FACEBOOK_ACCESS_TOKEN!;
const pixel_id = process.env.FACEBOOK_PIXEL_ID!;
const api = bizSdk.FacebookAdsApi.init(access_token);

const now = new Date();
const timestamp = Math.floor(new Date(now.getTime() - 5 * 60000).getTime() / 1000);

export const facebook = {
  setEvent: async function (
    event: string, 
    remoteAddress: string, 
    userAgent: string,
    fbp: string,
    sourceUrl: string,
    user: Users
  ) {
    const userData = (new UserData())
      .setEmails([user.email])
      .setPhones([user.phone!])
      .setClientIpAddress(remoteAddress)
      .setClientUserAgent(userAgent)
      .setFbp(fbp);

    const serverEvent = (new ServerEvent())
      .setEventName(event)
      .setEventTime(timestamp)
      .setUserData(userData)
      .setEventSourceUrl(sourceUrl)
      .setActionSource('website');

    const eventsData = [serverEvent];
    const eventRequest = (new EventRequest(access_token, pixel_id))
      .setEvents(eventsData);

    eventRequest.execute().then(
      response => {
        console.log('Response: ', response);
      },
      err => {
        console.error('Error: ', err);
      }
    );

  }
}
