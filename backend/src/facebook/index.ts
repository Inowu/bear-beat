import { Users } from '@prisma/client';
import * as bizSdk from 'facebook-nodejs-business-sdk';
const Content = bizSdk.Content;
const CustomData = bizSdk.CustomData;
const DeliveryCategory = bizSdk.DeliveryCategory;
const EventRequest = bizSdk.EventRequest;
const UserData = bizSdk.UserData;
const ServerEvent = bizSdk.ServerEvent;

const access_token = '<ACCESS_TOKEN>';
const pixel_id = '<ADS_PIXEL_ID>';
const api = bizSdk.FacebookAdsApi.init(access_token);

const timestamp = new Date().getTime();

export const facebook = {
  setEvent: async function (
    event: string, 
    remoteAddress: string, 
    userAgent: string,
    fbp: string,
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
      .setEventSourceUrl('http://jaspers-market.com/product/123')
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
