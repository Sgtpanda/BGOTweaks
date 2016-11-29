jQuery.fn.getWordBeforeCursor = function(){
	if(this.length === 0) return -1;
	var start =  this[0].selectionStart;
    // Split text into characters
    var chars = this.val().split('');
    // Get all characters before current
    var before = chars.slice(0, start);
    // Rejoin all characters then split on spaces to get words
    var words = before.join('').split(' ');
    // Return last word on the list
    return words.pop();
};

var chatHistory = [];
var emoteList = [];
var commands = ['/8ball','/achpoints','/ach','/coinflip','/item','/joke','/link'
                ,'lmgtfy','/me','/mute','/pickup','/rec','/roll','/video'];;
var chatIndex = 0;
var interval = -1;
var userID = -1;
var DEBUG = true;

function debugLog(msg){
    if (!DEBUG) return;
    console.debug(msg);
}

function checkPageLoaded(){
    debugLog("Checking Page Load");
    // If the loading message has gone then the page is ready
    if ($('#loadMessage').text() === ''){
        window.clearInterval(interval);
        pageLoaded();
    }
}

function findUserToReplyTo(){
    // If we don't already have the users ID
    if (userID === -1){
        // Then re-evaluate the InitBag in our context to fish it out
        var horribleHack = $('script:contains("InitBag")')[0].innerHTML;
        eval(horribleHack);
        userID = InitBag.User.ID;
        debugLog('Got user ID as ' + userID);
    }
    // Get the username that @'d them 
    return "@" + $("b.userName[data-id=" + userID + "]").parent().parent()
                                                        .children('.userName')
                                                        .last().text()
                                                        .slice(1,-1);
}

function addAutocomplete(source){
    // Setup autocomplete with a given (possibly empty) source
    $( "#chat_input" )
      .autocomplete({
        minLength: 2,
        source: function( request, response ) {
          response( $.ui.autocomplete.filter(
            source, $('#chat_input').getWordBeforeCursor() ) );
        },
        focus: function() {
            // ¯\_(ツ)_/¯
            return false;
        },
        select: function( event, ui ) {
            // Figure out length of word already typed
            var wordBeforeCursor = $(this).getWordBeforeCursor();
            var WBCLength = wordBeforeCursor.length;
            var cursorPos = this.selectionStart

            /* Get what they've typed before the cursor - excluding the word 
             * they're trying to autocomplete
             */
            var textBeforeCurrentWord = this.value.substr(0,cursorPos 
                                                                - WBCLength);

            // Get what's after the cursor
            var textAfterCursor = this.value.substr(cursorPos);
            
            // Reconstruct sentence from original text + selected word
            this.value =  textBeforeCurrentWord;
            this.value += ui.item.value.split(' - ')[0];
            this.value += textAfterCursor;

            // disable autocomplete
            $(this).autocomplete("disable");
            return false;
        }
      });
    $('.ui-autocomplete').addClass('bgotweaks');
}

function setAutocompleteSource(source){
    debugLog('setting autocomplete source to :')
    debugLog(source);
    // Set source as needed and set filter term to be word being typed
    $( "#chat_input" ).autocomplete("option","source", 
        function( request, response ) {
          response( $.ui.autocomplete.filter(
            source, $('#chat_input').getWordBeforeCursor() ) );
        });
}

// Function to enable autocomplete given a source array and word typed
function enableAutoComplete(source,word){
    debugLog('Enabling autocomplete with word: ' + word);
    // Why does this happen? Sometimes the autocomplete element get's deleted
    if ($( ".ui-autocomplete" ).length == 0){
        debugLog('Autocomplete got deleted for some reason?');
        // Destroy whatever is left and re-add autocomplete with needed source
        $('#chat_input').autocomplete("destroy");
        addAutocomplete(source);
    }
    else{
        // Else set existing autocomplete to the needed source
        setAutocompleteSource(source);
    }
    // Enable autocomplete and search
    $('#chat_input').autocomplete("enable");
    $('#chat_input').autocomplete("search",word);
}

function emoteAutocomplete(word){
    // If we don't already have a list of emotes then prepare for horrible hack
    if (emoteList.length === 0){
        // Oh boy, click the 'List of all emotes button'
        $('#allChatEmotes')[0].click();
        // Then quickly close it
        $('#page_emotes > .page_close')[0].click();
        debugLog('Getting emotes');
        // Then wait for the list to be fully populated
        var wait = setInterval(function(){
            // Get list of emotes on page (cutting off the header)
            var emotes = $('#emotes_table > tbody > tr').slice(1);

            /* If we got nothing, or the number of emotes doesn't match how many
             * the page says there is, then try again
             */
            if (emotes.length > 0 && emotes.length == $('#emotes_total').text())
            {
                /* For each emote line split into children
                 * [0] is the actual emote, [1] is the 'self-use' description
                 * [2] is the 'use on other player' description 
                 * & also trim off full-stops for each description
                 */
                debugLog("Got emotes");
                emoteList = emotes.map(function(){
                                var children = this.children;
                                return "/" + $.trim(children[0].textContent 
                                        + " - " 
                                        + children[1].textContent.slice(0,-1) 
                                        + " - " 
                                        + children[2].textContent.slice(0,-1));
                            }).get();
                // Set emote list to be the list we got + hardcoded commands
                emoteList = emoteList.concat(commands);
                enableAutoComplete(emoteList,word);
                // and stop checking
                clearInterval(wait);
            }
        },100);
    }
    else{
        debugLog('Already got emotes');
        enableAutoComplete(emoteList,word);
    }
}

function userAutocomplete(word){
    debugLog('Getting users for autocomplete');

    /* Get a list of users by parsing the 'Online users section'
     * the filter is important, if we don't use it then we get back the :heart:
     * too
     */
    var userNames = $('.users > .chatUser').map(function(){
                        return "@" + $.trim($(this).contents().filter(function(){
                            return this.nodeType == 3;
                        })[0].nodeValue);
                    }).get();

    // Enable autocomplete with a list of usernames
    enableAutoComplete(userNames,word);
}

// This function does the work of figuring out what we're trying to autocomplete
function attemptAutoComplete(){
    // Get word they're attempting to autocomplete
    var word = $('#chat_input').getWordBeforeCursor();
    if (word === '/reply') {
        //If reply then find the user to reply to and swap out their name
        debugLog('Attemping autocomplete reply'); 
        var username = findUserToReplyTo();
        var newMessage = word.replace('/reply',username);
        $('#chat_input').val(newMessage);
    }
    else if (word[0] === '/'){
        // Else if it starts with a slash then it's an emote
        debugLog('Attemping autocomplete emote');
        emoteAutocomplete(word);
    }
    else{
        // Else it's a name I guess? ¯\_(ツ)_/¯
        debugLog('Attemping autocomplete username');
        userAutocomplete(word);
    }
}

function storeMessage(){
    debugLog('Storing Message');

    // Trim whitespace and push message onto history if not empty
    var message = $('#chat_input').val().trim();
    if (message === '') return;
    debugLog('Message was: ' + message);
    chatIndex = chatHistory.push(message);
}

function pageLoaded(){
    debugLog("Page Loaded");

    // Cheap hack to re-enable chat bar for testing logged out
    if (DEBUG){
        $('#chat_input').attr('disabled',false);
        $('#chat_input').val('');
    }

    // Variables for storing the current message & whether 'were at the 'bottom'
    var currentMessage = "";
    var bottom = true;

    $('#chat_input').keydown(function(event){
        // used to ignore up and down presses when selecting an item
        var suggestions = !!$($(this).autocomplete('widget')).is(':visible');
        if (event.which == $.ui.keyCode.UP && chatIndex > 0 && !suggestions){
            debugLog('UP Key Pressed');
            // If we were at the bottom then set the current message accordingly 
            if (bottom){
                currentMessage = $('#chat_input').val();
                bottom = false;
            }
            // Get the previous message from history
            $('#chat_input').val(chatHistory[--chatIndex]);
        }
        else if (event.which === $.ui.keyCode.DOWN && !suggestions){
            debugLog('DOWN Key Pressed');
            /* If down is pressed and we haven't hit the end of history then
             * get the next item and set input
             */
            if (chatIndex < chatHistory.length - 1){
                $('#chat_input').val(chatHistory[++chatIndex]);
            }
            else if (!bottom){
                /* Else we've hit the end and need to put their original message
                 * back, still increment the index out of bounds so we can
                 * pre-increment in the UP case (it works trust me)
                 */
                ++chatIndex;
                $('#chat_input').val(currentMessage);
                bottom = true;
            }
        }
        else if (event.which === $.ui.keyCode.ENTER){
            /* If enter pressed then diable and hide autocomplete, also store
             * the message in chat history and reset the current message
             */
            debugLog('ENTER Key Pressed - storing message & closing and' + 
                        'disabling autocomplete & resetting currentMessage');
            storeMessage();
            $('#chat_input').autocomplete("close");
            $('#chat_input').autocomplete("disable");
            currentMessage = "";
        }
        else if (event.which === $.ui.keyCode.TAB) {
            debugLog('TAB Key Pressed');
            // If menu isn't active then enable autocomplete with current text
            if (!$( this ).autocomplete( "instance" ).menu.active){
                debugLog('Attemping autocomplete and preventing default');
                attemptAutoComplete();
                event.preventDefault();
            }
            else{
                /* Else prevent moving to next element and let jQUI handler
                 * selecting the item user has highligted
                 */
                debugLog('Attemping autocomplete and returning false')
                return false;
            }
        }
        else if (event.which === $.ui.keyCode.SPACE) {
            // If new word started then hide & diable autocomplete
            debugLog('SPACE Key Pressed - closing and disabling autocomplete');
            $(this).autocomplete("close");
            $(this).autocomplete("disable");
        }
    });

    $('#chat_input').on('input propertychange paste', function() {
        var cursorPos = this.selectionStart
        // if user delete's the word they were searching for then disable
        if (this.value === '' || this.value[cursorPos - 1] === ' '){
            $(this).autocomplete("close");
            $(this).autocomplete("disable");            
        }
    });


    /* Horrible hack to remove the event handler on the send button and 
     * substitute it with our own 
     */
    var button = $('#chat_button')[0];
    var parent = button.parentNode;
    parent.replaceChild(button.cloneNode(true),button);

    /* Register a new event handler that makes it look like the user pressed
     * enter instead
     */
    $('#chat_button').click(function(){
        var e = $.Event('keyup');
        e.keyCode = $.ui.keyCode.ENTER;
        $('#chat_input').trigger(e);
    });

    addAutocomplete([]);
}

// Check if page is loaded every second
interval = window.setInterval(checkPageLoaded,1000);