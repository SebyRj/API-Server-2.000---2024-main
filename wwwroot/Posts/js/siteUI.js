////// Author: Nicolas Chourot
////// 2024
//////////////////////////////

const periodicRefreshPeriod = 2;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;
let currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

let categories = [];
let selectedCategory = "";
let currentETag = "";
let currentPostsCount = -1;
let periodic_Refresh_paused = false;
let postsPanel;
let itemLayout;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;


Init_UI();
async function Init_UI() {
    postsPanel = new PageManager('postsScrollPanel', 'postsPanel', 'postSample', renderPosts);
    $('#createPost').on("click", async function () {
        showCreatePostForm();
    });
    $('#abort').on("click", async function () {
        showPosts();
    });
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $("#showSearch").on('click', function () {
        toogleShowKeywords();
        showPosts();
    });

    installKeywordsOnkeyupEvent();
    await showPosts();
    start_Periodic_Refresh();
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {

    $("#searchKeys").on('keyup', function () {
        clearTimeout(keywordsOnchangeTimger);
        keywordsOnchangeTimger = setTimeout(() => {
            cleanSearchKeywords();
            showPosts(true);
        }, keywordsOnchangeDelay);
    });
    $("#searchKeys").on('search', function () {
        showPosts(true);
    });
}
function cleanSearchKeywords() {
    /* Keep only keywords of 3 characters or more */
    let keywords = $("#searchKeys").val().trim().split(' ');
    let cleanedKeywords = "";
    keywords.forEach(keyword => {
        if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
    });
    $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
    $("#hiddenIcon").hide();
    $("#showSearch").show();
    if (showKeywords) {
        $("#searchKeys").show();
    }
    else
        $("#searchKeys").hide();
}
function hideSearchIcon() {
    $("#hiddenIcon").show();
    $("#showSearch").hide();
    $("#searchKeys").hide();
}
function toogleShowKeywords() {
    showKeywords = !showKeywords;
    if (showKeywords) {
        $("#searchKeys").show();
        $("#searchKeys").focus();
    }
    else {
        $("#searchKeys").hide();
        showPosts(true);
    }
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function intialView() {
    $("#createPost").show();
    $("#hiddenIcon").hide();
    $("#hiddenIcon2").hide();
    $('#menu').show();
    $('#commit').hide();
    $('#abort').hide();
    $('#form').hide();
    $('#form').empty();
    $('#aboutContainer').hide();
    $('#errorContainer').hide();
    showSearchIcon();
}
async function showPosts(reset = false) {
    intialView();
    $("#viewTitle").text("Fil de nouvelles");
    periodic_Refresh_paused = false;
    await postsPanel.show(reset);
}
function hidePosts() {
    postsPanel.hide();
    hideSearchIcon();
    $("#createPost").hide();
    $('#menu').hide();
    periodic_Refresh_paused = true;
}
function showForm() {
    hidePosts();
    $('#form').show();
    $('#commit').show();
    $('#abort').show();
}
function showError(message, details = "") {
    hidePosts();
    $('#form').hide();
    $('#form').empty();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#commit').hide();
    $('#abort').show();
    $("#viewTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").empty();
    $("#errorContainer").append($(`<div>${message}</div>`));
    $("#errorContainer").append($(`<div>${details}</div>`));
}
function showLoginForm(newAccount = false) {

    showForm();
    $("#viewTitle").text("Connexion");
    renderLoginForm(newAccount);
}
function showVerifyForm() {
    showForm();
    $("#viewTitle").text("Connexion");
    renderVerifyForm();
}
function showRegisterForm() {

    showForm();
    $("#viewTitle").text("Inscription");
    renderUserForm();
}
function showModifyForm(user){
    showForm();
    $("#viewTitle").text("Modification de profil");
    renderUserForm(user);
}
function showCreatePostForm() {
    showForm();
    $("#viewTitle").text("Ajout de nouvelle");
    renderPostForm();
}
function showEditPostForm(id) {
    showForm();
    $("#viewTitle").text("Modification");
    renderEditPostForm(id);
}
function showDeletePostForm(id) {
    showForm();
    $("#viewTitle").text("Retrait");
    renderDeletePostForm(id);
}
function showAbout() {
    hidePosts();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#abort').show();
    $("#viewTitle").text("À propos...");
    $("#aboutContainer").show();
}

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

function start_Periodic_Refresh() {
    $("#reloadPosts").addClass('white');
    $("#reloadPosts").on('click', async function () {
        $("#reloadPosts").addClass('white');
        postsPanel.resetScrollPosition();
        await showPosts();
    })
    setInterval(async () => {
        if (!periodic_Refresh_paused) {
            let etag = await Posts_API.HEAD();
            // the etag contain the number of model records in the following form
            // xxx-etag
            let postsCount = parseInt(etag.split("-")[0]);
            if (currentETag != etag) {
                if (postsCount != currentPostsCount) {
                    console.log("postsCount", postsCount)
                    currentPostsCount = postsCount;
                    $("#reloadPosts").removeClass('white');
                } else
                    await showPosts();
                currentETag = etag;
            }
        }
    },
        periodicRefreshPeriod * 1000);
}
async function renderPosts(queryString) {
    let endOfData = false;
    queryString += "&sort=date,desc";
    compileCategories();
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    if (showKeywords) {
        let keys = $("#searchKeys").val().replace(/[ ]/g, ',');
        if (keys !== "")
            queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ',')
    }
    addWaitingGif();
    let response = await Posts_API.Get(queryString);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        currentPostsCount = parseInt(currentETag.split("-")[0]);
        let Posts = response.data;
        if (Posts.length > 0) {
            Posts.forEach(Post => {
                postsPanel.append(renderPost(Post));
            });
        } else
            endOfData = true;
        linefeeds_to_Html_br(".postText");
        highlightKeywords();
        attach_Posts_UI_Events_Callback();
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}
function renderPost(post, loggedUser) {
    let date = convertToFrenchDate(UTC_To_Local(post.Date));
    let crudIcon =
        `
        <span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier nouvelle"></span>
        <span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer nouvelle"></span>
        `;

    return $(`
        <div class="post" id="${post.Id}">
            <div class="postHeader">
                ${post.Category}
                ${crudIcon}
            </div>
            <div class="postTitle"> ${post.Title} </div>
            <img class="postImage" src='${post.Image}'/>
            <div class="postDate"> ${date} </div>
            <div postId="${post.Id}" class="postTextContainer hideExtra">
                <div class="postText" >${post.Text}</div>
            </div>
            <div class="postfooter">
                <span postId="${post.Id}" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher la suite"></span>
                <span postId="${post.Id}" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Réduire..."></span>
            </div>         
        </div>
    `);
}
async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            if (!categories.includes(selectedCategory))
                selectedCategory = "";
            updateDropDownMenu(categories);
        }
    }
}
 function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();
    if(currentUser != null){
        
        DDMenu.append($(`
            <div class="ownerLayout">
                <div class="UserAvatarXSmall" style="background-image:url('${currentUser.Avatar}')"></div>
                <div>${currentUser.Name}</div>
            </div>
        `));
        DDMenu.append($(`<div class="dropdown-divider"></div>`));
        DDMenu.append($(`
            <div class="dropdown-item" id="modifyCmd">
                <i class="menuIcon fa fa-user-edit mx-2"></i> Modifier votre profil
            </div>
        `));
        DDMenu.append($(`
            <div class="dropdown-item" id="logoutCmd">
                <i class="menuIcon fa fa-sign-out-alt mx-2"></i> Déconnexion
            </div>
        `));
    }
    else{
        DDMenu.append($(`
            <div class="dropdown-item" id="loginCmd">
                <i class="menuIcon fa fa-sign-in mx-2"></i> Connexion
            </div>
        `));
    }

    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $('#loginCmd').on("click", function () {
        showLoginForm();
    });
    $('#modifyCmd').on("click", function () {
        showModifyForm(currentUser);
    });
    $('#logoutCmd').on("click", async function () {
        await Users_API.Logout(currentUser.Id)
        sessionStorage.setItem('currentUser', null);
        currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        showLoginForm();
    });
    $('#allCatCmd').on("click", async function () {
        selectedCategory = "";
        await showPosts(true);
        updateDropDownMenu();
    });
    $('.category').on("click", async function () {
        selectedCategory = $(this).text().trim();
        await showPosts(true);
        updateDropDownMenu();
    });
}
function attach_Posts_UI_Events_Callback() {

    linefeeds_to_Html_br(".postText");
    // attach icon command click event callback
    $(".editCmd").off();
    $(".editCmd").on("click", function () {
        showEditPostForm($(this).attr("postId"));
    });
    $(".deleteCmd").off();
    $(".deleteCmd").on("click", function () {
        showDeletePostForm($(this).attr("postId"));
    });
    $(".moreText").off();
    $(".moreText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).show();
        $(`.lessText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('showExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('hideExtra');
    })
    $(".lessText").off();
    $(".lessText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).hide();
        $(`.moreText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        postsPanel.scrollToElem($(this).attr("postId"));
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('hideExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('showExtra');
    })
}
function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        postsPanel.itemsPanel.append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Posts/Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////

function linefeeds_to_Html_br(selector) {
    $.each($(selector), function () {
        let postText = $(this);
        var str = postText.html();
        var regex = /[\r\n]/g;
        postText.html(str.replace(regex, "<br>"));
    })
}
function highlight(text, elem) {
    text = text.trim();
    if (text.length >= minKeywordLenth) {
        var innerHTML = elem.innerHTML;
        let startIndex = 0;

        while (startIndex < innerHTML.length) {
            var normalizedHtml = innerHTML.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var index = normalizedHtml.indexOf(text, startIndex);
            let highLightedText = "";
            if (index >= startIndex) {
                highLightedText = "<span class='highlight'>" + innerHTML.substring(index, index + text.length) + "</span>";
                innerHTML = innerHTML.substring(0, index) + highLightedText + innerHTML.substring(index + text.length);
                startIndex = index + highLightedText.length + 1;
            } else
                startIndex = innerHTML.length + 1;
        }
        elem.innerHTML = innerHTML;
    }
}
function highlightKeywords() {
    if (showKeywords) {
        let keywords = $("#searchKeys").val().split(' ');
        if (keywords.length > 0) {
            keywords.forEach(key => {
                let titles = document.getElementsByClassName('postTitle');
                Array.from(titles).forEach(title => {
                    highlight(key, title);
                })
                let texts = document.getElementsByClassName('postText');
                Array.from(texts).forEach(text => {
                    highlight(key, text);
                })
            })
        }
    }
}

//////////////////////// Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
    $('#commit').show();
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null)
            renderPostForm(Post);
        else
            showError("Post introuvable!");
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let post = response.data;
        if (post !== null) {
            let date = convertToFrenchDate(UTC_To_Local(post.Date));
            $("#form").append(`
                <div class="post" id="${post.Id}">
                <div class="postHeader">  ${post.Category} </div>
                <div class="postTitle ellipsis"> ${post.Title} </div>
                <img class="postImage" src='${post.Image}'/>
                <div class="postDate"> ${date} </div>
                <div class="postTextContainer showExtra">
                    <div class="postText">${post.Text}</div>
                </div>
            `);
            linefeeds_to_Html_br(".postText");
            // attach form buttons click event callback
            $('#commit').on("click", async function () {
                await Posts_API.Delete(post.Id);
                if (!Posts_API.error) {
                    await showPosts();
                }
                else {
                    console.log(Posts_API.currentHttpError)
                    showError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", async function () {
                await showPosts();
            });

        } else {
            showError("Post introuvable!");
        }
    } else
        showError(Posts_API.currentHttpError);
}
function newPost() {
    let Post = {};
    Post.Id = 0;
    Post.Title = "";
    Post.Text = "";
    Post.Image = "Posts/news-logo-upload.png";
    Post.Category = "";
    return Post;
}
function newUser() {
    let User = {};
    User.Id = 0;
    User.Name = "";
    User.Email = "";
    User.Password = "";
    User.Avatar = "Posts/no-avatar.png";
    return User;
}

function renderUserForm(user = null){
    let register = user == null;
    if (register) user = newUser();
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="userForm">
            <div class="formBoxes">

                <input type="hidden" name="Id" id="Id" value="${user.Id}"/>

                <label for="Email" class="form-label">Adresse de courriel </label>
                <input 
                    class="form-control Email"
                    name="Email"
                    id="Email"
                    placeholder="Courriel"
                    required
                    RequireMessage="Veuillez entrer votre courriel" 
                    InvalidMessage="Veuillez entrer un courriel valide"
                    value="${user.Email}"
                />
                <br>
                <input 
                    class="form-control MatchedInput"
                    matchedInputId="Email"
                    name="EmailVerify"
                    id="EmailVerify"
                    placeholder="Vérification"
                    required
                    RequireMessage="Obligatoire" 
                    value="${user.Email}"
                />
            </div>

            <div class="formBoxes">
                <label for="Password" class="form-label">Mot de passe </label>
                <input 
                    class="form-control "
                    type="password"
                    name="Password" 
                    id="Password" 
                    placeholder="Mot de passe"
                    required
                    RequireMessage="Veuillez entrer un mot de passe"
                    InvalidMessage="Mot de passe incorrect"
                    value="${user.Password}"
                />
                <br>
                <input 
                    class="form-control MatchedInput"
                    matchedInputId="Password"
                    type="password"
                    name="PasswordVerification" 
                    id="PasswordVerification" 
                    placeholder="Vérification"
                    required
                    RequireMessage="Obligatoire"
                    value="${user.Password}"
                />
            </div>
            
            <div class="formBoxes">
                <label for="Name" class="form-label">Nom </label>
                <input 
                    class="form-control"
                    name="Name"
                    id="Name"
                    placeholder="Nom"
                    required
                    value="${user.Name}"
                />
            </div>


            <div class="formBoxes">
                <label class="form-label">Avatar </label>
                <div class='avatarUploaderContainer'>
                    <div class='imageUploader' 
                        newImage='${register}' 
                        controlId='Avatar' 
                        imageSrc='${user.Avatar}' 
                        waitingImage="Posts/Loading_icon.gif">
                    </div>
                </div>
            </div>

            <br>
            <input type="submit" value="Enregistrer" id="registerUser" class="btn btn-primary" style="width: 100%;" >
            <hr style="width: 100%; margin: 10px 0;">
            <input type="button" value="Annuler" id="Cancel" class="btn btn-secondary" style="width: 100%;" >
        </form>
    `);
    

    initImageUploaders();
    initFormValidation();
    addConflictValidation('/accounts/conflict','Email','Enregistrer');

    $("#commit").hide()
    $('#userForm').on("submit", async function (event) {
        event.preventDefault();
        let user = getFormData($("#userForm"))
        user.Authorizations = currentUser.Authorizations;
        if(register){
            user = await Users_API.register(user)
        }else{
            user = await Users_API.Modify(user);
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        } 
        
        if (!Users_API.error) {
            
            if(register){
                await showLoginForm(true);
            }else{
                await showPosts();
            } 
            
        }
        else
            showError("Une erreur est survenue! ", Posts_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}

function renderLoginForm(newAccount = false) {
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <div style="font-weight: bold;" id="newAccountMsg">
            Votre compte a été creé. veuillez prendre vos courriels pour récupérer votre code de vérification qui vous sera démandé lors de votre prochaine connexion.
        </div>
        `);
    $("#form").append(`
        <form class="form loginForm" id="loginForm">
            <input 
                class="form-control Email"
                name="Email"
                id="Email"
                placeholder="Courriel"
                required
                RequireMessage="Veuillez entrer votre courriel" 
                InvalidMessage="Veuillez entrer un courriel valide"
                value=""
            />
            <span id="emailError" class="error-message" style="color: red; display: none;">
                Courriel introuvable
            </span>
            <br>
            <input 
                class="form-control "
                type="password"
                name="Password" 
                id="Password" 
                placeholder="Mot de passe"
                required
                RequireMessage="Veuillez entrer un mot de passe"
                InvalidMessage="Mot de passe incorrect"
                value=""
            />
            <span id="passwordError" class="error-message" style="color: red; display: none;">
                Mot de passe incorrect
            </span>
            <br>
            <input type="submit" value="Entrer" id="loginUser" class="btn btn-primary" style="width: 100%;" >
            <hr style="width: 100%; margin: 10px 0;">
            <input type="button" value="Nouveau compte" id="registerUser" class="btn btn-secondary" style="width: 100%;" >
        </form>
    `);
  
    initFormValidation();


    $("#commit").hide();
    if(newAccount){
        $("#newAccountMsg").show();
    }
    else{
        $("#newAccountMsg").hide();
    }
    $('#registerUser').on("click", async function () {
        await showRegisterForm();
    });
    $('#loginForm').on("submit", async function (event) {
        $("#emailError").hide();
        $("#passwordError").hide();
        event.preventDefault();
        let loginInfo = getFormData($("#loginForm"));


        user = await Users_API.Login(loginInfo);
        
        if (!Users_API.error) {
            sessionStorage.setItem('currentUser', JSON.stringify(user.User));
            currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
            if(currentUser.VerifyCode != "verified"){
                await showVerifyForm();
            }
            else{
                await showPosts();
            }


        }
        else{
            if(Users_API.currentHttpError === "This user email is not found."){
                $("#emailError").show();
                console.log("passe")
            }
            else if(Users_API.currentHttpError === "Wrong password."){
                $("#passwordError").show();
            }
            console.log("Une erreur est survenue! ", Users_API.currentHttpError);
        }
            
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}
function renderVerifyForm(){
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <div style="font-weight: bold;" id="newAccountMsg">
            Veuillez entrer le code de vérification recu par courriel
        </div>
        `);
    $("#form").append(`
        <form class="form loginForm" id="verifyForm">
            <input type="hidden" name="id" id="id" value="${currentUser.Id}"/>
            <input 
                class="form-control"
                name="code"
                id="Code"
                placeholder="code de vérification"
                required
                RequireMessage="Veuillez entrer votre code" 
                value=""
            />
            <span id="codeError" class="error-message" style="color: red; display: none;">
                Code invalide
            </span>
            <br>
            <input type="submit" value="Vérifier" id="verifyUser" class="btn btn-primary" style="width: 100%;" >
            <hr style="width: 100%; margin: 10px 0;">
            
        </form>
    `);
  
    initFormValidation();


    $("#commit").hide();
    $("#codeError").hide();


    $('#verifyForm').on("submit", async function (event) {
        event.preventDefault();
        let verifyInfo = getFormData($("#verifyForm"));


        user = await Users_API.Verify(verifyInfo);
        
        if (!Users_API.error) {

            await showPosts();

        }
        else{
            if(Users_API.currentHttpError === "Verification code does not matched."){
                $("#codeError").show();
                
            }
            console.log("Une erreur est survenue! ", Users_API.currentHttpError);
        }
            
    });

}
function renderPostForm(post = null) {
    let create = post == null;
    if (create) post = newPost();
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
             <input type="hidden" name="Date" value="${post.Date}"/>
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control" 
                          name="Text" 
                          id="Text"
                          placeholder="Texte" 
                          rows="9"
                          required 
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='${create}' 
                     controlId='Image' 
                     imageSrc='${post.Image}' 
                     waitingImage="Posts/Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
    if (create) $("#keepDateControl").hide();

    initImageUploaders();
    initFormValidation(); // important do to after all html injection!

    $("#commit").click(function () {
        $("#commit").off();
        return $('#savePost').trigger("click");
    });
    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let post = getFormData($("#postForm"));
        if (post.Category != selectedCategory)
            selectedCategory = "";
        if (create || !('keepDate' in post))
            post.Date = Local_to_UTC(Date.now());
        delete post.keepDate;
        post = await Posts_API.Save(post, create);
        if (!Posts_API.error) {
            await showPosts();
            postsPanel.scrollToElem(post.Id);
        }
        else
            showError("Une erreur est survenue! ", Posts_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}
function getFormData($form) {
    // prevent html injections
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    // grab data from all controls
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}
