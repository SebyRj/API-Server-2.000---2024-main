
class Users_API {
    static Host_URL() { return "http://localhost:5000"; }
    static API_URL() { return this.Host_URL() + "/api/accounts" };
    static TOKEN_URL() { return this.Host_URL() + "/token";}
    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
    }
    static setHttpErrorState(xhr) {
        
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description;
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }
    static async HEAD() {
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL(),
                type: 'HEAD',
                contentType: 'text/plain',
                complete: data => { resolve(data.getResponseHeader('ETag')); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Get(id = null) {
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + (id != null ? "/" + id : ""),
                complete: data => { resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON }); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async GetQuery(queryString = "") {
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + queryString,
                complete: data => {
                    resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON });
                },
                error: (xhr) => {
                    Users_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
    static async Login(loginInfo){
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.TOKEN_URL(),
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(loginInfo),
                success: (data) => {  resolve(data); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Logout(userId){
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/logout/" + userId,
                type: "GET",
                contentType: 'application/json',
                success: (data) => { resolve(data); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Register(registerInfo){
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + "/register",
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(registerInfo),
                success: (data) => {resolve(data); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Delete(id) {
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + "/" + id,
                type: "DELETE",
                complete: () => {
                    Users_API.initHttpState();
                    resolve(true);
                },
                error: (xhr) => {
                    Users_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
}