import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { object, z } from 'zod';
import {
  createSubscriber,
  getInfo,
  setCustomField_phone,
  updateSubscriber,
} from './manyChatApi';
import { findByCustomField } from './manyChatApi';

export const addTagToUser = shieldedProcedure
  .input(
    z.object({
      tagName: z.string(),
    }),
  )
  .query(async ({ ctx: { session, prisma }, input: { tagName } }) => {
    const user = session!.user!;
    const users = await prisma.users.findFirst({
      where: {
        id: user.id,
      },
    });

    let many_chat_id = null;
    if (users?.id != null) {
      if (users.mc_id != null) {
        let userManyChat = await getInfo(users.mc_id);
        if (userManyChat.status == 'success') {
          if (!!userManyChat.data) {
            many_chat_id = userManyChat.data.id;
          }
        } else {
          let many_chat_id = await findByCustomField('phone', users.phone);
          if (many_chat_id == null) {
            let many_chat_id = await createSubscriber(user);
            let phone = users.phone;
            setCustomField_phone(many_chat_id, phone, '');
          }
        }
      } else {
        many_chat_id = await findByCustomField('phone', users.phone);
        if (many_chat_id == null) {
          many_chat_id = await createSubscriber(user);
          let phone = users.phone;
          setCustomField_phone(many_chat_id, phone, '');
        }
      }
      if (many_chat_id == null) {
        many_chat_id = await createSubscriber(user);
        let phone = users.phone;
        setCustomField_phone(many_chat_id, phone, '');
      }
      if (many_chat_id != null) {
        updateSubscriber(user, many_chat_id);
        let data_mc = {
          mc_id: many_chat_id,
        };
        prisma.users.update({
          where: { id: user.id },
          data: { mc_id: many_chat_id },
        });
      }
    } /*else {
                if(prisma.users.findFirst('is_'))
            }*/
  });
