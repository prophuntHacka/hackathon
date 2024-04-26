/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";
import {ActionMessage, RemotePlayerInterface} from "@workadventure/iframe-api-typings";
import { unsubscribe } from "diagnostics_channel";
import { callbackify } from "util";
import { promises } from "dns";

console.log('Script started successfully');

let currentPopup: any = undefined;
let triggerMessage: any;
let hideStatus = false;
let numberOfPlayers = 1;

WA.player.state.role = "none";


// Waiting for the API to be ready
WA.onInit().then(() => {

    CountPlayer();
    CallToActionMessage();
    waitForPlayer();

    let waitingRoom: any;
    

    async function CountPlayer(){
        await WA.players.configureTracking();
        const players = WA.players.list();
        for (const player of players) {
            console.log(`Player ${player.name} is near you`);
            numberOfPlayers++;
            console.log(numberOfPlayers);
        }
        WA.players.onPlayerEnters.subscribe((player: RemotePlayerInterface) => {
            numberOfPlayers++;
        });
        WA.players.onPlayerLeaves.subscribe((player: RemotePlayerInterface) => {
            numberOfPlayers--;
        });
    }

    async function waitForPlayer() {
        WA.ui.banner.openBanner({
            id: "waiting-player",
            text: "En attente de joueurs",
            bgColor: "#ff0000",
            textColor: "#000000",
            closable: true,
            timeToClose: 180000,
        });
        waitingRoom = await WA.ui.website.open({
            url: "../iframeTimer3min.html",
            position: {
                vertical: "top",
                horizontal: "right",
            },
            size: {
                height: "20vh",
                width: "20vw",
            },
        });
    }

     function afficherMessage() {
        if(numberOfPlayers<3){
            WA.ui.banner.closeBanner();
            WA.ui.banner.openBanner({
                id: "waiting-player",
                text: "En attente de joueurs",
                bgColor: "#ff0000",
                textColor: "#000000",
                closable: true,
                timeToClose: 180000,
            });
        } else {
            clearInterval(intervalID); // Arrête l'exécution de la fonction toutes les 3 secondes
            clearTimeout(timeoutID); // Arrête le timeout pour la fin de l'affichage            
            WA.ui.banner.closeBanner();
            waitingRoom.close();
            initGame();
        }
    }

    //Timer qui vérifie toutes les sec si les joueurs sont 5 pour lancer la partie
    //dure pendant 3min
    var intervalID = setInterval(afficherMessage, 1000);
    var timeoutID = setTimeout(function() {
        clearInterval(intervalID); 
        console.log("Fin de l'affichage.");
      }, 180000);
   

      let Timer20sec:any;
      //initialise tout avant de lancer la partie
      function initGame(): void{
        Timer20sec = WA.ui.website.open({
            url: "../iframeTimer20sec.html",
            position: {
                vertical: "top",
                horizontal: "right",
            },
            size: {
                height: "20vh",
                width: "20vw",
            },
        });
        WA.ui.banner.openBanner({
            id: "ready-player",
            text: "La partie va commencer !",
            bgColor: "#00ff00",
            textColor: "#000000",
            closable: true,
            timeToClose: 5000,
        });

        
        //Désigner un Hunter
        //Donner le role Hider aux autres
        setTimeout(function() {
            onGameStart();
            Timer20sec.close();
          }, 20000);
    }
    
    async function onGameStart(): Promise<void>{
        WA.ui.banner.openBanner({
            id: "banner-hide",
            text: "La partie commence !",
            bgColor: "#000000",
            textColor: "#ffffff",
            closable: true,
            timeToClose: 5000,
        });
        //TP les joueurs
        WA.controls.disablePlayerProximityMeeting()
        //HideName pour les where player.role == hider -> hiders WA.player.hideName();
        //Mettre un chrono de 1min où seuls les hiders peuvent se déplacer et voir
        setTimeout(function() {
            let gameTimer = WA.ui.website.open({
                url: "../iframeTimer3min.html",
                position: {
                    vertical: "top",
                    horizontal: "right",
                },
                size: {
                    height: "90vh",
                    width: "90vw",
                },
            });
        }, 30000);
        //Libérer les Hunters
        if(WA.player.state.role == "Hider"){
            WA.ui.banner.openBanner({
                id: "banner-hide",
                text: "Vous avez 30secondes pour vous cacher",
                bgColor: "#000000",
                textColor: "#ffffff",
                closable: true,
                timeToClose: 30000,
            });
        }
        else if(WA.player.state.role == "Hunter"){
            WA.controls.disablePlayerControls();
            let BlindnessHunter = await WA.ui.website.open({
                url: "../iframeBlindnessHunter.html",
                position: {
                    vertical: "middle",
                    horizontal: "middle",
                },
                size: {
                    height: "90vh",
                    width: "90vw",
                },
            });
            setTimeout(function() {
                BlindnessHunter.close();
                WA.controls.restorePlayerControls();
              }, 30000);
        }
    }

    function CallToActionMessage(): void {
        if(WA.player.state.role == "Hider"){
            triggerMessage?.remove();
            triggerMessage = WA.ui.displayActionMessage({
                message: "press 'SPACE' to hide",
                callback: () => {
                    //Créer une area pour que le joueur soit "trouvable"
                    WA.player.getPosition().then((position) => {
                        const xCoordinate: number = position.x;
                        const yCoordinate: number = position.y;
                        hideStatus = true;
            
                        WA.room.area.create({
                            name: 'hiddenArea',
                            x: xCoordinate,
                            y: yCoordinate,
                            width: 60,
                            height: 60,
                        })
                        //Bloquer les mouvements du joueur
                        WA.controls.disablePlayerControls();

                        WA.ui.banner.openBanner({
                            id: "banner-hide",
                            text: "Vous êtes caché",
                            bgColor: "#000000",
                            textColor: "#ffffff",
                            closable: true,
                        });
            
                        //Afficher un CTA pour que le joueur puisse se déplacer et supprimer l'area
                        triggerMessage?.remove();
                        triggerMessage = WA.ui.displayActionMessage({
                            message: "press 'SPACE' to move",
                            callback: () => {
                                WA.controls.restorePlayerControls();
                                WA.room.area.delete('hiddenArea');
                                if (hideStatus){
                                    CallToActionMessage();
                                    WA.ui.banner.openBanner({
                                        id: "banner-hide",
                                        text: "Vous n'êtes plus cachés",
                                        bgColor: "#000000",
                                        textColor: "#ffffff",
                                        closable: true,
                                        timeToClose: 5000,
                                    });
                                }
                                hideStatus = false;
                            }})
            
                    }).catch((error) => {
                        // Gérer les erreurs de la promesse
                        console.error("Une erreur s'est produite :", error);
                    });
                }
            });
        } else if(WA.player.state.role == "Hunter") {
            //La logique pour trouver un joueur
            triggerMessage?.remove();
            WA.room.area.onEnter('hiddenArea').subscribe(() => {
                console.log("Joueur trouvé !")
            })
            triggerMessage = WA.ui.displayActionMessage({
                message: "press 'SPACE' to find nearby players",
                callback: () => {
                    console.log("TEEEEEST");
                    CallToActionMessage();
                }
                });
                
        } else{
            //La logique quand tu n'as pas encore de role, donc le lobby
            WA.player.state.onVariableChange('role').subscribe(()=>{
                CallToActionMessage();
                })
            triggerMessage?.remove();
            triggerMessage = WA.ui.displayActionMessage({
                message: "Go in the room to play",
                callback: () => {
                    CallToActionMessage();
                }
                });
        }
    }

    WA.room.area.onLeave('hiddenArea').subscribe(closePopup)

    WA.room.area.onEnter('clock').subscribe(() => {
        const today = new Date();
        const time = today.getHours() + ":" + today.getMinutes();
        currentPopup = WA.ui.openPopup("clockPopup", "It's " + time, []);
    })

    WA.room.area.onLeave('clock').subscribe(closePopup)

    const becomeHunter = function()
    {
        WA.player.setOutlineColor(255, 0 ,0);    //rouge = hunter
        WA.player.state.role = "Hunter";
        WA.ui.banner.openBanner({
            id: "banner-test",
            text: "Vous êtes désormais un chasseur",
            bgColor: "#000000",
            textColor: "#ffffff",
            closable: true,
            timeToClose: 5000,
        });
    }
    const becomeHider = function(){
        WA.player.setOutlineColor(0, 0 ,255);    //bleu = hider
        WA.player.state.role = "Hider";
        WA.ui.banner.openBanner({
            id: "banner-test",
            text: "Vous êtes désormais une proie",
            bgColor: "#000000",
            textColor: "#ffffff",
            closable: true,
            timeToClose: 5000,
        });
    }

    WA.room.area.onEnter('hunter').subscribe(() => {
        becomeHunter();
    })
    WA.room.area.onEnter('hider').subscribe(() => {
        becomeHider();
    })
    WA.room.area.onLeave('hunter').subscribe(closePopup)
    WA.room.area.onLeave('hider').subscribe(closePopup)

    WA.room.area.onEnter('to-home').subscribe(() => {
    })
    WA.room.area.onLeave('to-home').subscribe(closePopup)

    // The line below bootstraps the Scripting API Extra library that adds a number of advanced properties/features to WorkAdventure
    bootstrapExtra().then(() => {
        console.log('Scripting API Extra ready');
    }).catch(e => console.error(e));

}).catch(e => console.error(e));

function closePopup(){
    if (currentPopup !== undefined) {
        currentPopup.close();
        currentPopup = undefined;
    }
}

export {};
