import ridl from 'ridl';
import * as Actions from '../store/constants';
import AlertMsg from '../models/alerts/AlertMsg'
import PluginRepository from '../plugins/PluginRepository'
import {Blockchains} from '../models/Blockchains'

const enabled = false;

PluginRepository.plugin(Blockchains.EOS).getEndorsedNetwork().then(network => ridl.setNetwork(network));

export default class RIDLService {

    constructor(){}

    static async claimIdentity(newName, identity, context){
        return new Promise(async(resolve,reject) => {

            if(!newName.length) return resolve(null);
            const hash = await ridl.identity.getHash(newName);
            if(!hash) return resolve(context[Actions.PUSH_ALERT](AlertMsg.NoSuchIdentityName()));

            context[Actions.PUSH_ALERT](AlertMsg.ClaimIdentity(newName)).then(async res => {
                if(!res || !res.hasOwnProperty('text')) return resolve(null);

                if(!PluginRepository.plugin(Blockchains.EOS).validPrivateKey(res.text))
                    return resolve(context[Actions.PUSH_ALERT](AlertMsg.InvalidPrivateKey()));

                const signedHash = ridl.sign(hash, res.text);
                delete res.text;

                const claimed = await ridl.identity.claim(newName, signedHash, identity.publicKey);
                if(!claimed) return resolve(context[Actions.PUSH_ALERT](AlertMsg.NoSuchIdentityName()));

                // Removing now unused randomized RIDL account
                if(!await ridl.identity.registered(identity.name)) {
                    const previousHash = await ridl.identity.getHash(identity.name);
                    const signedStaleHash = previousHash ? await context[Actions.SIGN_RIDL]({hash:previousHash, publicKey:identity.publicKey}) : false;
                    if(signedStaleHash) await ridl.identity.release(identity.name, signedStaleHash);
                }

                identity.name = newName;
                identity.ridl = parseInt(claimed.registered);
                resolve(identity);
                //5KjbZQLH3EAfgXF3jejYM2WZjzJCUQH7NEkT1mVcBy2xoFdSWro
            })

        });


    }

    static async identify(publicKey){
        if(!enabled) return ridl.identity.randomName();
        const name = await ridl.identity.randomUniqueName();
        if(!await ridl.identity.identify(name, publicKey)) return null;
        return name;
    }
}